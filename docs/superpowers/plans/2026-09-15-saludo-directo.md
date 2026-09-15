# Saludo Directo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user with the new `oyente_plus` role connect their microphone live to Elim LLDM Radio for exactly 5 seconds from a new `/saludo-directo` page, only when no plática is currently live.

**Architecture:** Two new Supabase migrations (role + audit table), one new API route that gates access and hands back the existing radio-bridge WebSocket credentials, one new gated page, and one new client component that reuses the existing `connectRadioBridge`/`AudioMixer`/`startStreamingToBridge` helpers from `src/lib/radio-broadcast.ts` (the same code the "Estudio en Vivo" radio panel already uses) with a hard 5-second client-side cutoff.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + Auth + RLS), existing WebSocket radio bridge (`elim-live-bridge` on 46.224.234.223, unchanged by this plan).

**Out of scope (see spec §4 and §6):** the bridge-side hard timeout (server enforcing the 5s cutoff even if the browser tab freezes) lives in a separate infra repo (`live-bridge-azuracast`) and is NOT built here — the client still sends `mode: "saludo_directo"` in its `hello` payload so that work can be wired up later without another client change. Rate limiting and a structured `programas` schedule are also out of scope per the spec.

---

## File Structure

- **Create** `supabase/migrations/0050_oyente_plus_role.sql` — adds `oyente_plus` to the `profiles.role` CHECK constraint.
- **Create** `supabase/migrations/0051_saludos_directos.sql` — new audit-log table + RLS.
- **Modify** `src/types/index.ts` — add `"oyente_plus"` to the `Role` union.
- **Modify** `src/components/admin/RoleSelect.tsx` — add the new role option.
- **Modify** `src/app/admin/usuarios/page.tsx` — add the new role to the filter dropdown.
- **Create** `src/app/api/saludo-directo/radio-key/route.ts` — auth + role + "nobody live" gate, returns bridge credentials.
- **Create** `src/app/(public)/saludo-directo/page.tsx` — Server Component that renders the right state (login CTA / not-eligible message / live-blocked message / the button).
- **Create** `src/components/saludo-directo/SaludoDirectoButton.tsx` — client component: mic capture, bridge connection, 5s countdown, audit insert.
- **Modify** `src/components/layout/PublicHeader.tsx` — add the nav link (desktop + mobile).
- **Modify** `src/lib/radio-broadcast.ts` — export the `SALUDO_DIRECTO_DURATION_MS` constant and extend `connectRadioBridge`'s `hello` payload with an optional `mode` field.

Each task below is self-contained and independently verifiable — there's no existing Vitest/Playwright setup in this repo (confirmed: no test script, no test files), so "tests" here means a concrete manual verification step (curl or browser), not fabricated automated tests.

---

### Task 1: Add the `oyente_plus` role to the database

**Files:**
- Create: `supabase/migrations/0050_oyente_plus_role.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Elim LLDM — Rol "oyente_plus"
--
-- Categoría de oyente (no de staff) habilitada para usar el botón de
-- "Saludo Directo" en /saludo-directo — conectar su micrófono en vivo
-- a la radio por 5 segundos exactos, cuando no hay ninguna plática en
-- vivo. Se asigna a mano desde /admin/usuarios, igual que moderador y
-- super_moderador.
-- ============================================================

-- Mismo patrón que 0030_moderador_role.sql y 0039_super_moderador_role.sql:
-- el CHECK de profiles.role nunca tuvo un nombre fijo, se ubica
-- dinámicamente para no dejar el constraint viejo bloqueando el valor
-- nuevo en silencio.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%IN%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'anfitrion', 'participante', 'moderador', 'super_moderador', 'oyente_plus'));
```

- [ ] **Step 2: Verify the file is well-formed SQL**

Run: `node -e "require('fs').readFileSync('supabase/migrations/0050_oyente_plus_role.sql','utf8')"`
Expected: no output, exit code 0 (just confirms the file exists and is readable — the actual SQL is verified against the real database in Task 8).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0050_oyente_plus_role.sql
git commit -m "feat: add oyente_plus role migration"
```

---

### Task 2: Add the `saludos_directos` audit table

**Files:**
- Create: `supabase/migrations/0051_saludos_directos.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Elim LLDM — Bitácora de Saludo Directo
--
-- Un registro por cada vez que un oyente_plus/admin usa el botón de
-- /saludo-directo. Sin contenido de audio (no se graba nada) — solo
-- quién y cuándo, para que un admin pueda revisar uso/abuso y decidir
-- si retirar el rol oyente_plus a alguien.
-- ============================================================

CREATE TABLE saludos_directos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saludos_directos_user ON saludos_directos(user_id, created_at DESC);

ALTER TABLE saludos_directos ENABLE ROW LEVEL SECURITY;

-- El propio usuario registra su saludo (vía la API route, con su sesión).
CREATE POLICY "saludos_directos_insert_own" ON saludos_directos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Solo admin puede leer la bitácora.
CREATE POLICY "saludos_directos_select_admin" ON saludos_directos FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- GRANTs explícitos — sin esto, ni siquiera un usuario autenticado que
-- pasa la policy puede ejecutar la consulta (gotcha ya documentado
-- varias veces en este proyecto, ver 0019_jugadores_en_linea_grants.sql).
GRANT INSERT, SELECT ON saludos_directos TO authenticated;
```

- [ ] **Step 2: Verify the file is well-formed SQL**

Run: `node -e "require('fs').readFileSync('supabase/migrations/0051_saludos_directos.sql','utf8')"`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0051_saludos_directos.sql
git commit -m "feat: add saludos_directos audit table migration"
```

---

### Task 3: Wire the new role into the TypeScript type and the admin UI

**Files:**
- Modify: `src/types/index.ts:1`
- Modify: `src/components/admin/RoleSelect.tsx:44-48`
- Modify: `src/app/admin/usuarios/page.tsx:101-107`

- [ ] **Step 1: Add `oyente_plus` to the `Role` union**

In `src/types/index.ts`, line 1 currently reads:

```typescript
export type Role = "admin" | "anfitrion" | "participante" | "moderador" | "super_moderador";
```

Change it to:

```typescript
export type Role = "admin" | "anfitrion" | "participante" | "moderador" | "super_moderador" | "oyente_plus";
```

- [ ] **Step 2: Add the option to `RoleSelect.tsx`**

In `src/components/admin/RoleSelect.tsx`, the `<select>` currently ends with:

```tsx
      <option value="participante">Participante</option>
      <option value="anfitrion">Anfitrión</option>
      <option value="moderador">Moderador</option>
      <option value="super_moderador">Super Moderador</option>
      <option value="admin">Admin</option>
    </select>
```

Add the new option right after `participante` (it's a listener tier, grouped with it, not with the staff roles):

```tsx
      <option value="participante">Participante</option>
      <option value="oyente_plus">Oyente Plus</option>
      <option value="anfitrion">Anfitrión</option>
      <option value="moderador">Moderador</option>
      <option value="super_moderador">Super Moderador</option>
      <option value="admin">Admin</option>
    </select>
```

- [ ] **Step 3: Add the option to the filter dropdown**

In `src/app/admin/usuarios/page.tsx`, the filter `<select name="role">` currently has:

```tsx
          <option value="">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="super_moderador">Super Moderador</option>
          <option value="moderador">Moderador</option>
          <option value="anfitrion">Anfitrión</option>
          <option value="participante">Participante</option>
        </select>
```

Add the new option:

```tsx
          <option value="">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="super_moderador">Super Moderador</option>
          <option value="moderador">Moderador</option>
          <option value="anfitrion">Anfitrión</option>
          <option value="oyente_plus">Oyente Plus</option>
          <option value="participante">Participante</option>
        </select>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by these three edits (pre-existing errors elsewhere, if any, are not this task's concern — compare against a run before this task if unsure).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/components/admin/RoleSelect.tsx src/app/admin/usuarios/page.tsx
git commit -m "feat: add oyente_plus to Role type and admin role pickers"
```

---

### Task 4: Extend the radio-broadcast helper with the greeting duration and bridge `mode`

**Files:**
- Modify: `src/lib/radio-broadcast.ts:1-35`

- [ ] **Step 1: Add the duration constant and extend `connectRadioBridge`**

`src/lib/radio-broadcast.ts` currently starts with:

```typescript
export function connectRadioBridge(wsUrl: string, key: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
```

Replace the function signature and its `hello` send with a version that accepts an optional `mode`, and add the duration constant above it:

```typescript
/**
 * Duración fija del Saludo Directo (/saludo-directo) — un solo lugar para
 * ajustarla si se decide cambiarla más adelante. El corte real a los 5s lo
 * hace el propio componente con un temporizador; ver el plan de
 * implementación para el respaldo server-side pendiente (fuera de este
 * repo).
 */
export const SALUDO_DIRECTO_DURATION_MS = 5000;

export function connectRadioBridge(wsUrl: string, key: string, mode?: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
```

Then further down in the same function, the `open` handler currently sends:

```typescript
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "hello", key }));
    });
```

Change it to include `mode` when given:

```typescript
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "hello", key, ...(mode ? { mode } : {}) }));
    });
```

This is backward compatible — every existing caller (`RadioBroadcastPanel.tsx`) calls `connectRadioBridge(wsUrl, key)` with two arguments, so `mode` stays `undefined` and the `hello` payload is unchanged for them.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. `RadioBroadcastPanel.tsx`'s existing two-argument call must still type-check (it does — `mode` is optional).

- [ ] **Step 3: Commit**

```bash
git add src/lib/radio-broadcast.ts
git commit -m "feat: support optional bridge mode and export greeting duration"
```

---

### Task 5: `POST /api/saludo-directo/radio-key`

**Files:**
- Create: `src/app/api/saludo-directo/radio-key/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const eligible = profile?.role === "oyente_plus" || profile?.role === "admin";
  if (!eligible) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: livePláticas } = await supabase
    .from("platikas")
    .select("id")
    .eq("status", "live")
    .limit(1);

  if (livePláticas && livePláticas.length > 0) {
    return NextResponse.json(
      { error: "Hay una transmisión en vivo ahora mismo — inténtalo más tarde." },
      { status: 409 }
    );
  }

  const wsUrl = process.env.ELIM_RADIO_BRIDGE_WS_URL;
  const key = process.env.ELIM_RADIO_BRIDGE_KEY;

  if (!wsUrl || !key) {
    return NextResponse.json({ error: "Radio bridge not configured" }, { status: 503 });
  }

  return NextResponse.json({ wsUrl, key });
}
```

Note this deliberately mirrors `src/app/api/platikas/[id]/radio-key/route.ts` (same env vars, same shape) — it reads `profiles.role` and `platikas.status` directly rather than through `getProfile()`, matching the existing route's style.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Verify against a running dev server**

Run: `npm run dev` (leave running in one terminal), then in another:

```bash
curl -i -X POST http://localhost:3000/api/saludo-directo/radio-key
```

Expected: `HTTP/1.1 401` with body `{"error":"Unauthorized"}` (no session cookie sent) — confirms the route is wired up and the auth gate runs first. Full end-to-end behavior (403 / 409 / 200 paths) is verified in Task 8 against the deployed site with a real logged-in session, since a `curl` without a browser session cookie can only ever hit the 401 path.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/saludo-directo/radio-key/route.ts
git commit -m "feat: add radio-key route for Saludo Directo"
```

---

### Task 6: `SaludoDirectoButton` client component

**Files:**
- Create: `src/components/saludo-directo/SaludoDirectoButton.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Radio, Loader2, AlertCircle } from "lucide-react";
import {
  AudioMixer,
  connectRadioBridge,
  startStreamingToBridge,
  SALUDO_DIRECTO_DURATION_MS,
} from "@/lib/radio-broadcast";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "connecting" | "live" | "error";

export function SaludoDirectoButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(SALUDO_DIRECTO_DURATION_MS / 1000);

  const wsRef = useRef<WebSocket | null>(null);
  const mixerRef = useRef<AudioMixer | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cutoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function cleanup() {
    if (cutoffTimerRef.current) clearTimeout(cutoffTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    cutoffTimerRef.current = null;
    countdownTimerRef.current = null;

    recorderRef.current?.stop();
    recorderRef.current = null;

    mixerRef.current?.close();
    mixerRef.current = null;

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    wsRef.current?.close(1000, "saludo-directo-done");
    wsRef.current = null;
  }

  useEffect(() => () => cleanup(), []);

  async function start() {
    setStatus("connecting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/saludo-directo/radio-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo conectar con la radio");

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      const ws = await connectRadioBridge(data.wsUrl, data.key, "saludo_directo");
      wsRef.current = ws;

      const mixer = new AudioMixer();
      mixerRef.current = mixer;
      mixer.connect("mic", micStream);
      recorderRef.current = startStreamingToBridge(mixer.destination.stream, ws);

      ws.addEventListener("close", () => {
        if (wsRef.current !== ws) return;
        cleanup();
        setStatus("idle");
      });

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("saludos_directos").insert({ user_id: user.id });
      }

      setStatus("live");
      setSecondsLeft(SALUDO_DIRECTO_DURATION_MS / 1000);

      countdownTimerRef.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);

      cutoffTimerRef.current = setTimeout(() => {
        cleanup();
        setStatus("idle");
      }, SALUDO_DIRECTO_DURATION_MS);
    } catch (err) {
      cleanup();
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "No se pudo conectar con la radio");
    }
  }

  if (status === "live") {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
        style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)" }}
      >
        <span className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--color-live)" }}>
          <Radio size={16} className="animate-pulse" />
          AL AIRE
        </span>
        <span className="text-5xl font-bold" style={{ color: "var(--color-text)" }}>
          {secondsLeft}
        </span>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Tu micrófono está sonando en la radio ahora mismo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={start}
        disabled={status === "connecting"}
        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
        style={{ background: "var(--color-primary)", color: "#000", opacity: status === "connecting" ? 0.7 : 1 }}
      >
        {status === "connecting" ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
        {status === "connecting" ? "Conectando…" : "Dejar saludo en vivo (5s)"}
      </button>
      {status === "error" && errorMsg && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "var(--color-destructive)" }}
        >
          <AlertCircle size={14} className="shrink-0" />
          {errorMsg}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. This confirms `AudioMixer`, `connectRadioBridge`, `startStreamingToBridge`, `SALUDO_DIRECTO_DURATION_MS` are all correctly exported/imported per Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/components/saludo-directo/SaludoDirectoButton.tsx
git commit -m "feat: add SaludoDirectoButton client component"
```

---

### Task 7: `/saludo-directo` page

**Files:**
- Create: `src/app/(public)/saludo-directo/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Mic, LogIn, Lock, Radio } from "lucide-react";
import { getProfile, createClient } from "@/lib/supabase/server";
import { SaludoDirectoButton } from "@/components/saludo-directo/SaludoDirectoButton";
import type { Profile } from "@/types";

export const metadata: Metadata = {
  title: "Saludo Directo — Elim LLDM",
  description: "Conecta tu micrófono en vivo a Elim LLDM Radio por 5 segundos.",
};

export default async function SaludoDirectoPage() {
  // Mismo cast que src/app/(public)/layout.tsx — getProfile() no está
  // tipado contra el schema generado (aún no se corrió
  // `supabase gen types`, ver TODO en src/lib/supabase/server.ts).
  const profile = (await getProfile()) as Profile | null;

  let isLive = false;
  if (profile) {
    const supabase = await createClient();
    const { data: livePláticas } = await supabase
      .from("platikas")
      .select("id")
      .eq("status", "live")
      .limit(1);
    isLive = Boolean(livePláticas && livePláticas.length > 0);
  }

  const eligible = profile?.role === "oyente_plus" || profile?.role === "admin";

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
          style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.2)" }}
        >
          <Mic size={24} style={{ color: "var(--color-primary)" }} />
        </div>
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--color-text)" }}>
          Saludo Directo
        </h1>
        <p className="text-base mb-10" style={{ color: "var(--color-text-muted)" }}>
          Deja un saludo en vivo, en tu propia voz, directo a Elim LLDM Radio por 5 segundos.
        </p>

        {!profile && (
          <div
            className="rounded-2xl p-6 flex flex-col items-center gap-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Inicia sesión para usar Saludo Directo.
            </p>
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              <LogIn size={15} />
              Iniciar sesión
            </Link>
          </div>
        )}

        {profile && !eligible && (
          <div
            className="rounded-2xl p-6 flex flex-col items-center gap-2"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <Lock size={20} style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Saludo Directo es una función exclusiva para la categoría Oyente Plus.
            </p>
          </div>
        )}

        {profile && eligible && isLive && (
          <div
            className="rounded-2xl p-6 flex flex-col items-center gap-2"
            style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)" }}
          >
            <Radio size={20} style={{ color: "var(--color-live)" }} />
            <p className="text-sm" style={{ color: "var(--color-text)" }}>
              Hay una transmisión en vivo ahora mismo — Saludo Directo solo está disponible en
              tiempo regular. Inténtalo más tarde.
            </p>
          </div>
        )}

        {profile && eligible && !isLive && <SaludoDirectoButton />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. This confirms `createClient` is exported from `src/lib/supabase/server.ts` alongside `getProfile` (it already is — both are top-level exports in that file).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/saludo-directo/page.tsx"
git commit -m "feat: add /saludo-directo page"
```

---

### Task 8: Add the nav link

**Files:**
- Modify: `src/components/layout/PublicHeader.tsx:6,17-28`

- [ ] **Step 1: Import the icon and add the link**

Line 6 currently imports icons; add `Volume2` to the list:

```tsx
import { Menu, X, Radio, Mic, Gamepad2, Archive, Music, Video, Bot, LogIn, LogOut, ChevronDown, UserCircle, ShieldCheck, Mail, AudioLines, MessageSquareText, MessageCircle, Volume2 } from "lucide-react";
```

`NAV_LINKS` (lines 17-28) currently reads:

```tsx
const NAV_LINKS = [
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/saludo", label: "Saludos", icon: AudioLines },
  { href: "/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/juegos", label: "Juegos en línea", icon: Gamepad2 },
  { href: "/archivo", label: "Archivo", icon: Archive },
  { href: "/elimplay", label: "ElimPlay", icon: Music },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/elim-ia", label: "Elim IA", icon: Bot },
  { href: "/opiniones", label: "Opiniones", icon: MessageSquareText },
  { href: "/contacto", label: "Contáctanos", icon: Mail },
];
```

Add the new link right after `/saludo` (same family — greetings):

```tsx
const NAV_LINKS = [
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/saludo", label: "Saludos", icon: AudioLines },
  { href: "/saludo-directo", label: "Saludo Directo", icon: Volume2 },
  { href: "/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/juegos", label: "Juegos en línea", icon: Gamepad2 },
  { href: "/archivo", label: "Archivo", icon: Archive },
  { href: "/elimplay", label: "ElimPlay", icon: Music },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/elim-ia", label: "Elim IA", icon: Bot },
  { href: "/opiniones", label: "Opiniones", icon: MessageSquareText },
  { href: "/contacto", label: "Contáctanos", icon: Mail },
];
```

This single array drives both the desktop nav (lines ~104-127) and the mobile nav (lines ~271-293) — no other change needed, it shows for everyone (the page itself gates by role, same pattern as every other role-restricted page in this app, e.g. `/admin`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/PublicHeader.tsx
git commit -m "feat: add Saludo Directo link to nav"
```

---

### Task 9: Deploy and apply migrations to production

This is the only task with real, hard-to-reverse side effects (writing to the production database and pushing code that Vercel will auto-deploy) — confirm with the user before running the push/deploy sub-steps if anything about the diff looks unexpected.

**Files:** none (infra/deploy only).

- [ ] **Step 1: Push the branch**

```bash
git push origin master
```

Expected: Vercel picks up the push and starts a production deployment automatically (same as the earlier WHIP-URL fix this session).

- [ ] **Step 2: Apply the two new migrations to the real Supabase project**

Per `feedback_supabase_sql_editor_workflow` memory, the working CLI flow (as of 2026-09-08) is `npx supabase db push`, but any command that writes to the production database is blocked by the Claude Code auto-mode classifier even with the user's explicit consent — the only way through is for the **user** to run it themselves with the `!` prefix. Ask the user to run, from their own local `elim-lldm` clone (the one with `SUPABASE_ACCESS_TOKEN` in `.env.local` and the project already linked):

```
!npx supabase db push
```

If that clone doesn't have the two new migration files yet (e.g. it's a different checkout than the one this plan was executed in), have them `git pull origin master` first.

- [ ] **Step 3: Verify the migrations landed**

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/profiles?select=role&role=eq.oyente_plus" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected: `HTTP 200` with `[]` (empty array is fine — it means the query against the `role` column succeeded, i.e. the CHECK constraint migration applied; a `400`/`42703`-style error would mean it didn't). Read `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local` for this call.

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/saludos_directos?select=id&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected: `HTTP 200` with `[]` — confirms the table exists and `GRANT SELECT ... TO authenticated` didn't break the anon-key request being rejected outright with a table-not-found error (an empty RLS-filtered result and a genuinely empty table look the same here, which is fine — this call only proves the table and grants exist, not that RLS is correct; Task 2's policies were reviewed by hand).

- [ ] **Step 4: Grant yourself (or a test account) the `oyente_plus` role**

Ask the user to open `/admin/usuarios` on the live site, find a test account, and set its role to "Oyente Plus" via the dropdown (Task 3's UI change) — this is the only way to get a real session with the new role for the next step, and it's a data change the user should make themselves rather than doing it by direct SQL.

- [ ] **Step 5: End-to-end manual verification**

With that test account logged in and no plática currently live:

1. Visit `/saludo-directo` — expect to see the "Dejar saludo en vivo (5s)" button (not a login CTA or a "not eligible" message).
2. Click it, grant microphone permission when prompted.
3. Expect the UI to switch to "AL AIRE" with a 5 → 0 countdown, then automatically return to the button.
4. During those 5 seconds, check `https://radio.elimlldm.net` (or the AzuraCast now-playing API, `https://radio.elimlldm.net/api/nowplaying/2`) — confirm the mic audio is audible on the live stream.
5. Confirm a new row appeared in `saludos_directos` for that user (query via the SQL Editor, or `curl` the REST endpoint with the *service role* key since the anon key can't read it per the admin-only SELECT policy).
6. Start a test plática (`status='live'`) and confirm `/saludo-directo` now shows the "hay una transmisión en vivo" message instead of the button, and that `POST /api/saludo-directo/radio-key` returns `409` while it's live.

- [ ] **Step 6: Report back**

Summarize what was verified (and anything that didn't work) to the user — this task has no commit of its own, it's verification of everything committed in Tasks 1-8.
