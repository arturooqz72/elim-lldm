# Backstage (Green Room) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a conductor clicks "Ir en vivo" for a Programa, the session starts in a private `backstage` state (mic/camera testable, LiveKit room live) that only the host can see — nothing goes to the public site, no recording, no platform streaming — until the host explicitly clicks "Salir al aire".

**Architecture:** Add `backstage` as a new `platikas.status` value. `create-live` now creates the row (and LiveKit room) in `backstage` instead of `live`. The existing (currently unreachable) "Ir en Vivo" button in `HostControls` + its `api/platikas/[id]/go-live` route are revived and relabeled as "Salir al aire" — they already transition any non-`live` status to `live`; they're updated to be idempotent about room creation and to start the automatic recording (moved here from `create-live`). The public plática page gates access: non-hosts see a "no disponible" placeholder while `status === 'backstage'`.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres), LiveKit (`livekit-server-sdk`). No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-09-12-backstage-design.md` — read it for the reasoning behind reviving `go-live` instead of writing a new endpoint, and for what is explicitly out of scope (multi-destination streaming is a separate future plan).

**Files this plan reads but does not modify (reference patterns):**
- `src/lib/livekit/recording.ts` — `startProgramRecording(roomName, programaId, platikaId)`, already used by `create-live` today; this plan moves the *call site* to `go-live`, the function itself is untouched.
- `src/app/(public)/platikas/[id]/page.tsx:285` — `ScheduledState`/`EndedState` component style, reused for the new `BackstageBlockedState`.

---

### Task 1: Migration — add `backstage` to `platikas.status`

**Files:**
- Create: `supabase/migrations/0041_platikas_backstage_status.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Elim LLDM — Estado "backstage" para transmisiones (Estudio en Vivo)
--
-- Antes de salir al aire, el conductor entra a una sala privada donde
-- prueba mic/cámara — nadie más la ve ni la escucha, no se graba, no
-- sale a la radio ni a plataformas. Ver
-- docs/superpowers/specs/2026-09-12-backstage-design.md.
--
-- El constraint de status en platikas no tiene nombre explícito en
-- 0001_init.sql, así que se busca dinámicamente (mismo patrón ya usado
-- en 0030_moderador_role.sql para el constraint de profiles.role).
-- ============================================================

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'platikas'::regclass
    AND pg_get_constraintdef(oid) ILIKE '%status%IN%';

  EXECUTE format('ALTER TABLE platikas DROP CONSTRAINT %I', constraint_name);
  EXECUTE $sql$
    ALTER TABLE platikas ADD CONSTRAINT platikas_status_check
      CHECK (status IN ('scheduled', 'backstage', 'live', 'ended'))
  $sql$;
END $$;
```

- [ ] **Step 2: Apply it to production**

Run: `supabase db push`
Expected: prompts to confirm pushing `0041_platikas_backstage_status.sql`, then `Finished supabase db push.`

Confirm independently (the CLI's own success message isn't proof — verify via REST, same pattern used all session):

Run:
```bash
SUPA_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | cut -d= -f2)
SUPA_ANON=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local | cut -d= -f2)
curl -s -X POST "$SUPA_URL/rest/v1/rpc/pg_typeof" -H "apikey: $SUPA_ANON" > /dev/null # warm connection, ignore output
curl -s "$SUPA_URL/rest/v1/platikas?select=status&status=eq.backstage&limit=1" -H "apikey: $SUPA_ANON" -H "Authorization: Bearer $SUPA_ANON"
```
Expected: `[]` (empty array — the constraint accepts the value and the query executes; a `42501`/permission-denied body is also fine here since it proves the constraint didn't reject the *shape* of the query — a `23514` check-violation-style error would mean the migration didn't apply).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0041_platikas_backstage_status.sql
git commit -m "feat: agregar estado backstage a platikas"
```

---

### Task 2: `create-live` starts sessions in `backstage`, not `live`

**Files:**
- Modify: `src/app/api/platikas/create-live/route.ts`

- [ ] **Step 1: Change the status and drop the recording call**

Find this block (currently sets status directly to `"live"` and starts recording immediately):

```ts
  const startedAt = new Date().toISOString();

  // Grabación automática (solo audio) — mejor esfuerzo: si B2/LiveKit no
  // están configurados para esto, la transmisión sigue sin grabarse.
  const recordingEgressId = await startProgramRecording(roomName, programaId, id);

  console.log(`${LOG_TAG} updating platika row to live...`, { id });
  const { error: updateError } = await supabase
    .from("platikas")
    .update({
      status: "live",
      livekit_room_name: roomName,
      started_at: startedAt,
      recording_egress_id: recordingEgressId,
    })
    .eq("id", id);
```

Replace it with:

```ts
  const startedAt = new Date().toISOString();

  // La sesión nace en "backstage": el host ya puede probar mic/cámara
  // (la sala de LiveKit ya existe), pero nadie más la ve, no se graba y
  // no sale a ninguna plataforma hasta que el host le dé "Salir al
  // aire" (api/platikas/[id]/go-live) — ver
  // docs/superpowers/specs/2026-09-12-backstage-design.md.
  console.log(`${LOG_TAG} updating platika row to backstage...`, { id });
  const { error: updateError } = await supabase
    .from("platikas")
    .update({
      status: "backstage",
      livekit_room_name: roomName,
      started_at: startedAt,
    })
    .eq("id", id);
```

- [ ] **Step 2: Remove the now-unused import**

Find:
```ts
import { startProgramRecording } from "@/lib/livekit/recording";
```

Delete that line — `create-live` no longer calls `startProgramRecording` (Task 3 moves the call to `go-live`).

- [ ] **Step 3: Type-check and commit**

Run: `pnpm tsc --noEmit`
Expected: no errors.

```bash
git add src/app/api/platikas/create-live/route.ts
git commit -m "feat: create-live deja la sesion en backstage, no live"
```

---

### Task 3: Revive `go-live` as "Salir al aire" — idempotent room creation + starts recording

**Files:**
- Modify: `src/app/api/platikas/[id]/go-live/route.ts`

- [ ] **Step 1: Replace the whole file**

Current file creates the LiveKit room unconditionally (would collide with the one `create-live` already made in Task 2) and checks the old `anfitrion` role, which no longer applies to Programas since freeform pláticas were removed. Replace the full contents with:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { startProgramRecording } from "@/lib/livekit/recording";

// "Salir al aire": transiciona una sesión fuera de backstage hacia
// "live" — es el momento en que se vuelve visible/escuchable para el
// público, empieza a grabarse, y (fase 2) arrancan los destinos de
// streaming. Ver docs/superpowers/specs/2026-09-12-backstage-design.md.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_moderador"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: pláticas } = await supabase
    .from("platikas")
    .select("*")
    .eq("id", id)
    .single();

  if (!pláticas) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pláticas.host_id !== user.id && profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (pláticas.status === "live") {
    return NextResponse.json({ error: "Already live" }, { status: 400 });
  }

  let roomName = pláticas.livekit_room_name as string | null;

  if (!roomName) {
    // Defensa: si por alguna razón llegó aquí sin sala (ej. una fila
    // vieja de antes del backstage), se crea ahora en vez de fallar.
    roomName = `platikas-${id}`;
    const roomService = new RoomServiceClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );
    await roomService.createRoom({ name: roomName, emptyTimeout: 300 });
  }

  const startedAt = (pláticas.started_at as string | null) ?? new Date().toISOString();

  // Grabación automática (solo audio) — mejor esfuerzo: si B2/LiveKit
  // no están configurados, la transmisión sigue sin grabarse.
  const recordingEgressId = pláticas.programa_id
    ? await startProgramRecording(roomName, pláticas.programa_id as string, id)
    : null;

  const { error } = await supabase
    .from("platikas")
    .update({
      status: "live",
      livekit_room_name: roomName,
      started_at: startedAt,
      recording_egress_id: recordingEgressId,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ roomName });
}
```

- [ ] **Step 2: Type-check and commit**

Run: `pnpm tsc --noEmit`
Expected: no errors.

```bash
git add "src/app/api/platikas/[id]/go-live/route.ts"
git commit -m "feat: revivir go-live como Salir al aire (idempotente + graba)"
```

---

### Task 4: `LiveKitRoom` starts with the real initial live state

**Files:**
- Modify: `src/components/platikas/LiveKitRoom.tsx`

Today this component hardcodes `useState(true)` for `isLive` because it was only ever rendered from the parent page's `isLive && ...` branch. Backstage needs it rendered for the host while `isLive` is actually `false`.

- [ ] **Step 1: Accept an `initialIsLive` prop**

Find:
```ts
interface LiveKitRoomProps {
  platikaId: string;
  roomName: string;
  isHost: boolean;
  isSpeaker: boolean;
  currentUserId: string | null;
  // Separado de isHost a propósito: isHost controla el rol LiveKit (mic,
  // cámara, "host" del token) de ESTA plática puntual; canModerateChat es
  // un permiso más amplio (también admin/moderador globales) que solo
  // debe afectar el botón de moderar del chat, no los controles de sala.
  canModerateChat: boolean;
  programaAudios?: ProgramaAudio[];
}
```

Replace with:

```ts
interface LiveKitRoomProps {
  platikaId: string;
  roomName: string;
  isHost: boolean;
  isSpeaker: boolean;
  currentUserId: string | null;
  // Separado de isHost a propósito: isHost controla el rol LiveKit (mic,
  // cámara, "host" del token) de ESTA plática puntual; canModerateChat es
  // un permiso más amplio (también admin/moderador globales) que solo
  // debe afectar el botón de moderar del chat, no los controles de sala.
  canModerateChat: boolean;
  programaAudios?: ProgramaAudio[];
  // false mientras la sesión está en backstage — HostControls muestra
  // "Salir al aire" en vez del panel de radio/streaming/cola de espera.
  initialIsLive: boolean;
}
```

- [ ] **Step 2: Use it in the destructured props and the state initializer**

Find:
```ts
export function LiveKitRoom({
  platikaId,
  roomName,
  isHost,
  isSpeaker,
  currentUserId,
  canModerateChat,
  programaAudios,
}: LiveKitRoomProps) {
  const [tokenState, setTokenState] = useState<TokenState>({ status: "loading" });
  const [isLive, setIsLive] = useState(true);
```

Replace with:

```ts
export function LiveKitRoom({
  platikaId,
  roomName,
  isHost,
  isSpeaker,
  currentUserId,
  canModerateChat,
  programaAudios,
  initialIsLive,
}: LiveKitRoomProps) {
  const [tokenState, setTokenState] = useState<TokenState>({ status: "loading" });
  const [isLive, setIsLive] = useState(initialIsLive);
```

- [ ] **Step 3: Type-check and commit**

Run: `pnpm tsc --noEmit`
Expected: errors in `src/app/(public)/platikas/[id]/page.tsx` ("Property 'initialIsLive' is missing") — expected at this point, Task 5 fixes the caller. Do not commit yet if you see that error; it's resolved in the next task's own type-check step.

```bash
git add src/components/platikas/LiveKitRoom.tsx
git commit -m "feat: LiveKitRoom acepta initialIsLive en vez de asumir live"
```

---

### Task 5: Gate the public plática page for `backstage` sessions

**Files:**
- Modify: `src/app/(public)/platikas/[id]/page.tsx`

- [ ] **Step 1: Compute `isBackstage` alongside the other status flags**

Find:
```ts
  const isLive = p.status === "live";
  const isScheduled = p.status === "scheduled";
  const isEnded = p.status === "ended";
```

Replace with:

```ts
  const isLive = p.status === "live";
  const isBackstage = p.status === "backstage";
  const isScheduled = p.status === "scheduled";
  const isEnded = p.status === "ended";
```

- [ ] **Step 2: Add a BACKSTAGE status badge**

Find:
```tsx
              {isScheduled && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(212,160,23,0.1)",
                    border: "1px solid rgba(212,160,23,0.2)",
                    color: "var(--color-primary)",
                  }}
                >
                  <Clock size={11} />
                  PRÓXIMA
                </span>
              )}
```

Add this block immediately before it:

```tsx
              {isBackstage && isHost && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(212,160,23,0.1)",
                    border: "1px solid rgba(212,160,23,0.2)",
                    color: "var(--color-primary)",
                  }}
                >
                  <Clock size={11} />
                  BACKSTAGE — solo tú la ves
                </span>
              )}
```

- [ ] **Step 3: Branch the room area for backstage — host gets the studio, everyone else gets a placeholder**

Find:
```tsx
        <div className="max-w-7xl mx-auto px-4 py-6">
          {isLive && p.livekit_room_name ? (
            <LiveKitRoom
              platikaId={id}
              roomName={p.livekit_room_name}
              isHost={isHost}
              isSpeaker={isSpeaker}
              currentUserId={currentUserId}
              canModerateChat={canModerateChat}
              programaAudios={programaAudios}
            />
          ) : isScheduled ? (
            <ScheduledState scheduledAt={p.scheduled_at} />
          ) : isEnded ? (
            <EndedState recordingUrl={p.recording_url} />
```

Replace with:

```tsx
        <div className="max-w-7xl mx-auto px-4 py-6">
          {(isLive || (isBackstage && isHost)) && p.livekit_room_name ? (
            <LiveKitRoom
              platikaId={id}
              roomName={p.livekit_room_name}
              isHost={isHost}
              isSpeaker={isSpeaker}
              currentUserId={currentUserId}
              canModerateChat={canModerateChat}
              programaAudios={programaAudios}
              initialIsLive={isLive}
            />
          ) : isBackstage ? (
            <BackstageBlockedState />
          ) : isScheduled ? (
            <ScheduledState scheduledAt={p.scheduled_at} />
          ) : isEnded ? (
            <EndedState recordingUrl={p.recording_url} />
```

- [ ] **Step 4: Add the `BackstageBlockedState` component**

Find the `ScheduledState` function definition (around line 285):
```tsx
function ScheduledState({ scheduledAt }: { scheduledAt: string | null }) {
```

Add this new function immediately before it:

```tsx
function BackstageBlockedState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded-2xl gap-6"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{
          background: "rgba(212,160,23,0.08)",
          border: "1px solid rgba(212,160,23,0.2)",
        }}
      >
        <Clock size={32} style={{ color: "var(--color-primary)" }} />
      </div>
      <div className="text-center max-w-sm">
        <p className="font-semibold mb-1" style={{ color: "var(--color-text)" }}>
          Todavía no está en vivo
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          El conductor está preparando esta transmisión. Vuelve a intentarlo en unos minutos.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Type-check and commit**

Run: `pnpm tsc --noEmit`
Expected: no errors (this task supplies the `initialIsLive` prop that Task 4 introduced).

```bash
git add "src/app/(public)/platikas/[id]/page.tsx"
git commit -m "feat: ocultar backstage del publico, mostrar placeholder a no-hosts"
```

---

### Task 6: Relabel the button "Salir al aire" in `HostControls`

**Files:**
- Modify: `src/components/platikas/HostControls.tsx`

The handler and route are correct as-is (Task 3); only the label needs to change so the host isn't confused between "Ir en Vivo" (ambiguous with the Programas "Ir en vivo" button that got them into backstage in the first place) and this one, which actually leaves backstage.

- [ ] **Step 1: Change the button text**

Find:
```tsx
              {loading === "live" ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
              Ir en Vivo
            </button>
```

Replace with:

```tsx
              {loading === "live" ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
              Salir al aire
            </button>
```

- [ ] **Step 2: Add a short explanatory line above the button so it's clear this is the backstage exit**

Find:
```tsx
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Controles del anfitrión
        </p>

        <div className="flex flex-col gap-2">
          {!isLive ? (
```

Replace with:

```tsx
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Controles del anfitrión
        </p>

        {!isLive && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Estás en backstage: prueba tu mic y cámara. Nadie más te ve ni te escucha todavía.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {!isLive ? (
```

- [ ] **Step 3: Type-check and commit**

Run: `pnpm tsc --noEmit`
Expected: no errors.

```bash
git add src/components/platikas/HostControls.tsx
git commit -m "feat: renombrar boton a Salir al aire y explicar el backstage"
```

---

### Task 7: Show a BACKSTAGE badge in the admin history list

**Files:**
- Modify: `src/app/admin/platikas/page.tsx`

Today this page groups sessions into `live` / `scheduled` / `ended` buckets. A `backstage` session would currently fall into none of them and disappear from the admin's own history view.

- [ ] **Step 1: Add `backstage` to the grouping**

Find:
```ts
  const byStatus = {
    live: (platikas ?? []).filter((p: { status: string }) => p.status === "live"),
    scheduled: (platikas ?? []).filter((p: { status: string }) => p.status === "scheduled"),
    ended: (platikas ?? []).filter((p: { status: string }) => p.status === "ended"),
  };
```

Replace with:

```ts
  const byStatus = {
    live: (platikas ?? []).filter((p: { status: string }) => p.status === "live"),
    backstage: (platikas ?? []).filter((p: { status: string }) => p.status === "backstage"),
    scheduled: (platikas ?? []).filter((p: { status: string }) => p.status === "scheduled"),
    ended: (platikas ?? []).filter((p: { status: string }) => p.status === "ended"),
  };
```

- [ ] **Step 2: Include it in the rendered sections and label/color switches**

Find:
```tsx
      {(["live", "scheduled", "ended"] as const).map((status) => {
        const items = byStatus[status];
        if (items.length === 0) return null;
        return (
          <section key={status} className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
              {status === "live" ? "En vivo" : status === "scheduled" ? "Programadas" : "Terminadas"}
```

Replace with:

```tsx
      {(["live", "backstage", "scheduled", "ended"] as const).map((status) => {
        const items = byStatus[status];
        if (items.length === 0) return null;
        return (
          <section key={status} className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
              {status === "live"
                ? "En vivo"
                : status === "backstage"
                ? "En backstage"
                : status === "scheduled"
                ? "Programadas"
                : "Terminadas"}
```

- [ ] **Step 3: Add the backstage color case to the status pill**

Find:
```tsx
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background:
                          p.status === "live"
                            ? "rgba(255,68,68,0.15)"
                            : p.status === "scheduled"
                            ? "rgba(212,160,23,0.1)"
                            : "var(--color-surface-elevated)",
                        color:
                          p.status === "live"
                            ? "var(--color-live)"
                            : p.status === "scheduled"
                            ? "var(--color-primary)"
                            : "var(--color-text-muted)",
                      }}
                    >
                      {p.status === "live" ? "EN VIVO" : p.status === "scheduled" ? "PROGRAMADA" : "TERMINADA"}
                    </span>
```

Replace with:

```tsx
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background:
                          p.status === "live"
                            ? "rgba(255,68,68,0.15)"
                            : p.status === "backstage" || p.status === "scheduled"
                            ? "rgba(212,160,23,0.1)"
                            : "var(--color-surface-elevated)",
                        color:
                          p.status === "live"
                            ? "var(--color-live)"
                            : p.status === "backstage" || p.status === "scheduled"
                            ? "var(--color-primary)"
                            : "var(--color-text-muted)",
                      }}
                    >
                      {p.status === "live"
                        ? "EN VIVO"
                        : p.status === "backstage"
                        ? "BACKSTAGE"
                        : p.status === "scheduled"
                        ? "PROGRAMADA"
                        : "TERMINADA"}
                    </span>
```

- [ ] **Step 4: Type-check and commit**

Run: `pnpm tsc --noEmit`
Expected: no errors.

```bash
git add src/app/admin/platikas/page.tsx
git commit -m "feat: mostrar sesiones en backstage en el historial de admin"
```

---

### Task 8: Prevent duplicate sessions from `/platikas/programas`

**Files:**
- Modify: `src/app/(public)/platikas/programas/page.tsx`

Today this page always shows "Ir en vivo" per programa with no check for an already-running session (live or backstage) — clicking it twice (e.g. re-opening the tab after already starting backstage) creates a second, orphaned `platikas` row and a second LiveKit room for the same programa.

- [ ] **Step 1: Fetch active sessions per programa alongside the programa list**

Find:
```ts
  const supabase = await createClient();
  const { data } = await supabase
    .from("programas")
    .select("*")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  const programas = (data ?? []) as Programa[];
```

Replace with:

```ts
  const supabase = await createClient();
  const [{ data }, { data: activeSessions }] = await Promise.all([
    supabase.from("programas").select("*").eq("activo", true).order("nombre", { ascending: true }),
    supabase.from("platikas").select("id, programa_id").in("status", ["backstage", "live"]),
  ]);
  const programas = (data ?? []) as Programa[];
  const activeByPrograma = new Map(
    ((activeSessions ?? []) as Array<{ id: string; programa_id: string | null }>).map((s) => [s.programa_id, s.id])
  );
```

- [ ] **Step 2: Show "Continuar" instead of the go-live button when one exists**

Find:
```tsx
            <GoLiveProgramaButton programaId={programa.id} nombre={programa.nombre} />
```

Replace with:

```tsx
            {activeByPrograma.has(programa.id) ? (
              <Link
                href={`/platikas/${activeByPrograma.get(programa.id)}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                Continuar
              </Link>
            ) : (
              <GoLiveProgramaButton programaId={programa.id} nombre={programa.nombre} />
            )}
```

- [ ] **Step 3: Add the `Link` import**

Find:
```ts
import { redirect } from "next/navigation";
import { getProfile, createClient } from "@/lib/supabase/server";
import { GoLiveProgramaButton } from "@/components/platikas/GoLiveProgramaButton";
import type { Programa } from "@/types";
```

Replace with:

```ts
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile, createClient } from "@/lib/supabase/server";
import { GoLiveProgramaButton } from "@/components/platikas/GoLiveProgramaButton";
import type { Programa } from "@/types";
```

- [ ] **Step 4: Type-check and commit**

Run: `pnpm tsc --noEmit`
Expected: no errors.

```bash
git add "src/app/(public)/platikas/programas/page.tsx"
git commit -m "feat: evitar sesiones duplicadas ofreciendo Continuar"
```

---

### Task 9: Full build + manual live verification

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

Run: `pnpm run build`
Expected: exits 0, no `Failed to compile`.

- [ ] **Step 2: Push and deploy**

```bash
git push origin master
```

Wait for the Vercel deployment to reach `Ready` (`vercel ls --scope arturooqz72s-projects`, or `vercel inspect <url>` on the newest deployment).

- [ ] **Step 3: Manual live test — backstage is private**

1. As the conductor account, go to `/platikas/programas` and click "Ir en vivo" on a real Programa.
2. Confirm you land on `/platikas/{id}` with the **BACKSTAGE** badge visible, mic/camera controls working (test mic device selector + volume from the earlier session's work).
3. In a **second, unauthenticated/incognito browser**, visit the same `/platikas/{id}` URL directly.
   Expected: "Todavía no está en vivo" placeholder — no LiveKit connection, no audio, no chat.
4. Visit `/platikas` (the public list) in that same incognito browser.
   Expected: the backstage session does **not** appear anywhere in the list.

- [ ] **Step 4: Manual live test — going live**

1. Back in the host's tab, click **"Salir al aire"**.
2. Confirm the **EN VIVO** badge replaces BACKSTAGE, and the Radio panel / streaming-to-platforms / request queue sections now appear in `HostControls`.
3. Refresh the incognito browser's `/platikas/{id}` tab.
   Expected: now joins as a viewer normally.
4. Confirm a recording starts: check `/admin/programas/{id}` a few minutes after ending the session for a new entry under "Grabaciones anteriores" (per the recording feature built earlier this session).

- [ ] **Step 5: Manual live test — duplicate prevention**

1. While the session from Step 3 is still in backstage (before "Salir al aire"), open `/platikas/programas` again in the host's browser.
2. Confirm the same Programa now shows a **"Continuar"** link instead of "Ir en vivo", and it navigates back to the same `/platikas/{id}` session (no new row/room created).

- [ ] **Step 6: End the test session**

Click "Terminar plática" to close it out cleanly.
