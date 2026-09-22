# Trivia en vivo con participación desde TikTok — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar que un anfitrión/admin corra una trivia en vivo desde `/tiktok-trivia` donde los espectadores del TikTok Live oficial de Elim LLDM responden A/B/C/D comentando directamente en TikTok, sin salir de la app.

**Architecture:** Un servicio Node nuevo y separado (`tiktok-trivia-bridge`, fuera del repo `elim-lldm`, desplegado en el VPS 46.224.234.223 igual que el bridge de radio) mantiene la conexión persistente a TikTok Live vía `tiktok-live-connector` y expone un WebSocket propio. La página de control en `elim-lldm` (`/tiktok-trivia`, Next.js) se conecta a ese WebSocket, le indica qué pregunta está activa, recibe el primer comentario que acierte, y persiste resultados en dos tablas nuevas de Supabase. Reusa el banco de preguntas ya existente (`question_sets`/`questions`).

**Tech Stack:** Bridge: Node 20+, TypeScript, `ws`, `tiktok-live-connector` v2. Control page: Next.js 15 App Router, TypeScript, Supabase (Postgres + Auth + RLS), `canvas-confetti` (ya es dependencia del repo).

**Spec:** `docs/superpowers/specs/2026-09-22-tiktok-trivia-design.md`

**Nota sobre `tiktok-live-connector`:** se verificó en vivo instalando la versión publicada actual (`2.5.0`) el 2026-09-22 — la API real usada en este plan (`TikTokLiveConnection`, `WebcastEvent.CHAT`, `ControlEvent.DISCONNECTED`, `UserOfflineError`) viene de leer su `README.md`/`.d.ts` reales en ese momento, no de memoria. Si al ejecutar este plan la versión instalada difiere, revisar `node_modules/tiktok-live-connector/README.md` antes de escribir código contra una API distinta.

**Fuera de alcance:** ver spec, sección "Fuera de alcance". Además, este plan NO puede verificar el despliegue real en el VPS ni escribir en la base de datos de producción — esas partes del Task final requieren que el usuario las ejecute él mismo (mismo patrón ya usado en `docs/superpowers/plans/2026-09-15-saludo-directo.md`, Task 9).

---

## File Structure

**Proyecto nuevo y separado, fuera de `elim-lldm`** — `C:\Users\arturooq\tiktok-trivia-bridge\` (mismo patrón que el bridge de radio real, que vive en su propio repo/deploy en el VPS, no dentro de `elim-lldm`; el directorio `relay/` de `elim-lldm` está vacío y no se usa):
- **Create** `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`
- **Create** `src/scoring.ts` — lógica pura: normaliza comentarios a A/B/C/D y decide quién gana cada pregunta (primero en acertar).
- **Create** `src/scoring.test.ts` — pruebas de esa lógica con `node:test`, sin red ni TikTok real.
- **Create** `src/server.ts` — servidor WebSocket: autentica con clave compartida, mantiene la conexión a TikTok Live, enruta mensajes.
- **Create** `src/index.ts` — entrypoint: lee variables de entorno, arranca el servidor.

**Repo `elim-lldm`:**
- **Create** `supabase/migrations/0053_tiktok_trivia.sql` — tablas `tiktok_trivia_sesiones` y `tiktok_trivia_respuestas`, RLS + GRANTs.
- **Modify** `.env.local` y `.env.example` — agrega `ELIM_TIKTOK_BRIDGE_WS_URL` y `ELIM_TIKTOK_BRIDGE_KEY`.
- **Create** `src/lib/tiktok-trivia/bridge-client.ts` — helper de conexión WebSocket del lado del navegador (mismo patrón que `connectRadioBridge` en `src/lib/radio-broadcast.ts`).
- **Create** `src/app/api/tiktok-trivia/bridge-credentials/route.ts` — ruta protegida (anfitrión/admin) que entrega la URL y clave del bridge (mismo patrón que `src/app/api/platikas/[id]/radio-key/route.ts`).
- **Create** `src/components/tiktok-trivia/TikTokAnswerDisplay.tsx` — muestra las 4 opciones (no interactivo), reusa la paleta de colores de `src/components/arena/AnswerButtons.tsx`.
- **Create** `src/components/tiktok-trivia/TikTokTriviaLeaderboard.tsx` — tabla de posiciones de la sesión.
- **Create** `src/components/tiktok-trivia/TikTokTriviaResults.tsx` — pantalla final con podio y confeti, mismo patrón que `src/components/arena/WinnerScreen.tsx`.
- **Create** `src/components/tiktok-trivia/TikTokTriviaControl.tsx` — el componente cliente que orquesta las 3 pantallas y la conexión WebSocket.
- **Create** `src/app/(public)/tiktok-trivia/page.tsx` — página protegida (anfitrión/admin), carga los `question_sets` y renderiza `TikTokTriviaControl`.

No hay framework de tests en `elim-lldm` (confirmado en planes anteriores) — la verificación ahí es típecheck + build + pasos manuales. El proyecto del bridge sí puede tener pruebas reales con `node:test` porque es un proyecto nuevo sin esa limitación.

---

## Parte A — Bridge (proyecto nuevo, fuera de `elim-lldm`)

### Task 1: Scaffold del proyecto `tiktok-trivia-bridge`

**Files:**
- Create: `C:\Users\arturooq\tiktok-trivia-bridge\package.json`
- Create: `C:\Users\arturooq\tiktok-trivia-bridge\tsconfig.json`
- Create: `C:\Users\arturooq\tiktok-trivia-bridge\.env.example`
- Create: `C:\Users\arturooq\tiktok-trivia-bridge\.gitignore`

- [ ] **Step 1: Crear el directorio y `package.json`**

```bash
mkdir -p /c/Users/arturooq/tiktok-trivia-bridge/src
cd /c/Users/arturooq/tiktok-trivia-bridge
```

`package.json`:

```json
{
  "name": "tiktok-trivia-bridge",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "tsx --test src/scoring.test.ts"
  },
  "dependencies": {
    "tiktok-live-connector": "^2.5.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: `.env.example`**

```bash
# Puerto donde escucha el servidor WebSocket del bridge.
PORT=8082

# Clave compartida con la página de control de elim-lldm — debe ser
# idéntica a ELIM_TIKTOK_BRIDGE_KEY en el .env.local/Vercel de elim-lldm.
# Generar con: openssl rand -hex 32
TIKTOK_TRIVIA_BRIDGE_KEY=

# @usuario de TikTok de la cuenta oficial de Elim LLDM (sin @, tal como
# aparece en la URL de su live: tiktok.com/@usuario/live).
TIKTOK_USERNAME=

# Opcional — API key gratuita de https://www.eulerstream.com/. Sin esta
# clave tiktok-live-connector funciona igual pero con límites de tasa más
# bajos en su servidor de firmado compartido.
EULERSTREAM_API_KEY=
```

- [ ] **Step 4: `.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 5: Instalar dependencias**

```bash
npm install
```

Expected: instala sin errores (ya se confirmó en un scratchpad aparte que `tiktok-live-connector@2.5.0` instala limpio).

- [ ] **Step 6: Git init + commit inicial**

```bash
git init
git add package.json tsconfig.json .env.example .gitignore package-lock.json
git commit -m "$(cat <<'EOF'
chore: scaffold tiktok-trivia-bridge project

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Lógica de puntaje (`scoring.ts`) — TDD

**Files:**
- Create: `C:\Users\arturooq\tiktok-trivia-bridge\src\scoring.ts`
- Test: `C:\Users\arturooq\tiktok-trivia-bridge\src\scoring.test.ts`

- [ ] **Step 1: Escribir las pruebas primero**

`src/scoring.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnswerLetter, QuestionRound } from "./scoring.js";

test("parseAnswerLetter acepta letras y números, sin importar mayúsculas o espacios", () => {
  assert.equal(parseAnswerLetter("A"), "a");
  assert.equal(parseAnswerLetter(" b "), "b");
  assert.equal(parseAnswerLetter("3"), "c");
  assert.equal(parseAnswerLetter("D"), "d");
  assert.equal(parseAnswerLetter("z"), null);
  assert.equal(parseAnswerLetter(""), null);
});

test("QuestionRound le da el punto solo al primer comentario correcto", () => {
  const round = new QuestionRound("b");

  const wrong = round.submit({ uniqueId: "user1", nickname: "User One", comment: "a" });
  assert.equal(wrong, null);

  const winner = round.submit({ uniqueId: "user2", nickname: "User Two", comment: "b" });
  assert.ok(winner);
  assert.equal(winner?.tiktokUsername, "user2");
  assert.equal(winner?.answer, "b");

  const tooLate = round.submit({ uniqueId: "user3", nickname: "User Three", comment: "b" });
  assert.equal(tooLate, null);
});

test("QuestionRound usa el uniqueId como nombre si el nickname viene vacío", () => {
  const round = new QuestionRound("a");
  const winner = round.submit({ uniqueId: "user1", nickname: "", comment: "a" });
  assert.equal(winner?.tiktokDisplayName, "user1");
});
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

```bash
cd /c/Users/arturooq/tiktok-trivia-bridge
npx tsx --test src/scoring.test.ts
```

Expected: falla porque `./scoring.js` no existe todavía (error de módulo no encontrado).

- [ ] **Step 3: Implementar `scoring.ts`**

```typescript
export type AnswerLetter = "a" | "b" | "c" | "d";

export interface IncomingComment {
  uniqueId: string;
  nickname: string;
  comment: string;
}

export interface Winner {
  tiktokUsername: string;
  tiktokDisplayName: string;
  answer: AnswerLetter;
  ts: number;
}

const LETTER_MAP: Record<string, AnswerLetter> = {
  a: "a",
  "1": "a",
  b: "b",
  "2": "b",
  c: "c",
  "3": "c",
  d: "d",
  "4": "d",
};

/**
 * Normaliza un comentario a una letra de respuesta válida (a/b/c/d), o null
 * si no es una respuesta reconocible. Acepta mayúsculas/minúsculas, espacios
 * alrededor, y tanto la letra como el número de la opción (1-4).
 */
export function parseAnswerLetter(rawComment: string): AnswerLetter | null {
  const normalized = rawComment.trim().toLowerCase();
  return LETTER_MAP[normalized] ?? null;
}

/**
 * Una pregunta abierta: agrega comentarios y decide si alguno ya ganó. Solo
 * el PRIMER comentario que acierte cuenta — los siguientes se ignoran, sin
 * importar si también aciertan.
 */
export class QuestionRound {
  private winnerPicked = false;

  constructor(private readonly correctOption: AnswerLetter) {}

  /** Devuelve el Winner si este comentario es el primero en acertar, o null si no aplica. */
  submit(comment: IncomingComment): Winner | null {
    if (this.winnerPicked) return null;

    const answer = parseAnswerLetter(comment.comment);
    if (answer === null || answer !== this.correctOption) return null;

    this.winnerPicked = true;
    return {
      tiktokUsername: comment.uniqueId,
      tiktokDisplayName: comment.nickname || comment.uniqueId,
      answer,
      ts: Date.now(),
    };
  }
}
```

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

```bash
npx tsx --test src/scoring.test.ts
```

Expected: 3 pruebas, todas en verde (`# pass 3`).

- [ ] **Step 5: Commit**

```bash
git add src/scoring.ts src/scoring.test.ts
git commit -m "$(cat <<'EOF'
feat: add answer scoring logic with tests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Servidor WebSocket del bridge

**Files:**
- Create: `C:\Users\arturooq\tiktok-trivia-bridge\src\server.ts`
- Create: `C:\Users\arturooq\tiktok-trivia-bridge\src\index.ts`

- [ ] **Step 1: Escribir `src/server.ts`**

```typescript
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { TikTokLiveConnection, WebcastEvent, ControlEvent, UserOfflineError } from "tiktok-live-connector";
import { QuestionRound, type AnswerLetter } from "./scoring.js";

interface StartServerOptions {
  port: number;
  bridgeKey: string;
  tiktokUsername: string;
  eulerStreamApiKey?: string;
}

export function startServer(options: StartServerOptions) {
  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer });

  let tiktokConnection: TikTokLiveConnection | null = null;
  let currentRound: QuestionRound | null = null;
  let activeClient: WebSocket | null = null;

  function send(ws: WebSocket, msg: Record<string, unknown>) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  async function disconnectTikTok() {
    currentRound = null;
    if (tiktokConnection) {
      await tiktokConnection.disconnect();
      tiktokConnection = null;
    }
  }

  wss.on("connection", (ws) => {
    let authenticated = false;

    const authTimeout = setTimeout(() => {
      if (!authenticated) ws.close();
    }, 5000);

    ws.on("message", async (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (!authenticated) {
        clearTimeout(authTimeout);
        if (msg.type === "hello" && msg.key === options.bridgeKey) {
          authenticated = true;
          activeClient = ws;
          send(ws, { type: "ready" });
        } else {
          send(ws, { type: "error", message: "Clave inválida" });
          ws.close();
        }
        return;
      }

      if (msg.type === "start_session") {
        await disconnectTikTok();
        const connection = new TikTokLiveConnection(options.tiktokUsername, {
          signApiKey: options.eulerStreamApiKey,
        });
        tiktokConnection = connection;

        connection.on(WebcastEvent.CHAT, (data) => {
          if (!currentRound) return;
          const winner = currentRound.submit({
            uniqueId: data.user?.uniqueId ?? "",
            nickname: data.user?.nickname ?? "",
            comment: data.comment ?? "",
          });
          if (winner) {
            send(ws, {
              type: "winner",
              tiktokUsername: winner.tiktokUsername,
              tiktokDisplayName: winner.tiktokDisplayName,
              answer: winner.answer,
              ts: winner.ts,
            });
          }
        });

        connection.on(ControlEvent.DISCONNECTED, () => {
          send(ws, { type: "error", reason: "tiktok_disconnected" });
        });

        try {
          await connection.connect();
          send(ws, { type: "connected" });
        } catch (err) {
          const reason = err instanceof UserOfflineError ? "not_live" : "connect_failed";
          send(ws, { type: "error", reason });
          tiktokConnection = null;
        }
      } else if (msg.type === "open_question") {
        currentRound = new QuestionRound(msg.correctOption as AnswerLetter);
      } else if (msg.type === "close_question") {
        currentRound = null;
      } else if (msg.type === "end_session") {
        await disconnectTikTok();
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (activeClient === ws) {
        activeClient = null;
        void disconnectTikTok();
      }
    });
  });

  httpServer.listen(options.port, () => {
    console.log(`tiktok-trivia-bridge escuchando en el puerto ${options.port}`);
  });

  return { httpServer, wss };
}
```

- [ ] **Step 2: Escribir `src/index.ts`**

```typescript
import { startServer } from "./server.js";

const port = Number(process.env.PORT ?? 8082);
const bridgeKey = process.env.TIKTOK_TRIVIA_BRIDGE_KEY;
const tiktokUsername = process.env.TIKTOK_USERNAME;
const eulerStreamApiKey = process.env.EULERSTREAM_API_KEY || undefined;

if (!bridgeKey) throw new Error("Falta TIKTOK_TRIVIA_BRIDGE_KEY en el entorno");
if (!tiktokUsername) throw new Error("Falta TIKTOK_USERNAME en el entorno");

startServer({ port, bridgeKey, tiktokUsername, eulerStreamApiKey });
```

- [ ] **Step 3: Verificar que compila**

```bash
cd /c/Users/arturooq/tiktok-trivia-bridge
npx tsc -p tsconfig.json --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Verificación manual del handshake y el enrutamiento de mensajes**

Esta prueba usa la cuenta oficial `tiktok` de TikTok (prácticamente nunca está en vivo) solo para confirmar en vivo, contra los servidores reales de TikTok, que el camino "no está en vivo" funciona de punta a punta — no hace falta ninguna cuenta propia para esto.

Terminal 1:

```bash
cd /c/Users/arturooq/tiktok-trivia-bridge
PORT=8082 TIKTOK_TRIVIA_BRIDGE_KEY=test-key TIKTOK_USERNAME=tiktok npx tsx src/index.ts
```

Expected: imprime `tiktok-trivia-bridge escuchando en el puerto 8082`.

Terminal 2, cliente WebSocket de prueba (sin instalar nada nuevo — `ws` ya quedó instalado en Task 1):

```bash
cd /c/Users/arturooq/tiktok-trivia-bridge
node -e '
const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:8082");
ws.on("open", () => ws.send(JSON.stringify({ type: "hello", key: "test-key" })));
ws.on("message", (data) => {
  console.log("<-", data.toString());
  const msg = JSON.parse(data.toString());
  if (msg.type === "ready") ws.send(JSON.stringify({ type: "start_session" }));
  if (msg.type === "error" && msg.reason) process.exit(0);
});
'
```

Expected en Terminal 2: `<- {"type":"ready"}` seguido de `<- {"type":"error","reason":"not_live"}` (o `"connect_failed"` si hay un problema de red distinto — en ese caso revisar el mensaje de error real antes de continuar). Esto confirma el handshake de autenticación y que `start_session` sí dispara un intento de conexión real a TikTok.

Detener ambos procesos con Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts src/index.ts
git commit -m "$(cat <<'EOF'
feat: add WebSocket server wired to TikTok Live

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Parte B — `elim-lldm`

### Task 4: Migración de las tablas de Supabase

**Files:**
- Create: `supabase/migrations/0053_tiktok_trivia.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- ============================================================
-- Elim LLDM — Trivia en vivo con participación desde TikTok
--
-- Dos tablas de soporte para /tiktok-trivia: una fila por partida en
-- vivo (qué set de preguntas se usó, quién la corrió) y una fila por
-- cada pregunta que tuvo ganador (el primer comentario de TikTok que
-- acertó). Ver docs/superpowers/specs/2026-09-22-tiktok-trivia-design.md.
-- ============================================================

CREATE TABLE tiktok_trivia_sesiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id UUID NOT NULL REFERENCES question_sets(id),
  started_by UUID NOT NULL REFERENCES profiles(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'conectando'
    CHECK (status IN ('conectando', 'en_vivo', 'finalizada'))
);

CREATE TABLE tiktok_trivia_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID NOT NULL REFERENCES tiktok_trivia_sesiones(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  tiktok_username TEXT NOT NULL,
  tiktok_display_name TEXT NOT NULL,
  respondida_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tiktok_trivia_respuestas_sesion ON tiktok_trivia_respuestas(sesion_id);

ALTER TABLE tiktok_trivia_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_trivia_respuestas ENABLE ROW LEVEL SECURITY;

-- Sesiones: cualquier anfitrión/admin puede crear la suya y leer todas
-- (historial compartido), pero solo el dueño puede actualizarla.
CREATE POLICY "tiktok_trivia_sesiones_insert" ON tiktok_trivia_sesiones FOR INSERT
  TO authenticated
  WITH CHECK (
    started_by = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion'))
  );

CREATE POLICY "tiktok_trivia_sesiones_select" ON tiktok_trivia_sesiones FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion')));

CREATE POLICY "tiktok_trivia_sesiones_update_own" ON tiktok_trivia_sesiones FOR UPDATE
  TO authenticated
  USING (started_by = auth.uid());

-- Respuestas: solo se insertan dentro de una sesión propia; lectura igual
-- que sesiones.
CREATE POLICY "tiktok_trivia_respuestas_insert" ON tiktok_trivia_respuestas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tiktok_trivia_sesiones s
      WHERE s.id = sesion_id AND s.started_by = auth.uid()
    )
  );

CREATE POLICY "tiktok_trivia_respuestas_select" ON tiktok_trivia_respuestas FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion')));

-- GRANTs explícitos — gotcha ya documentado varias veces en este proyecto
-- (ver 0019_jugadores_en_linea_grants.sql): sin esto, ni siquiera un
-- usuario que pasa la policy puede ejecutar la consulta.
GRANT SELECT, INSERT, UPDATE ON tiktok_trivia_sesiones TO authenticated;
GRANT SELECT, INSERT ON tiktok_trivia_respuestas TO authenticated;
```

- [ ] **Step 2: Verificar que el archivo es SQL bien formado**

```bash
cd /c/Users/arturooq/elim-lldm
node -e "require('fs').readFileSync('supabase/migrations/0053_tiktok_trivia.sql','utf8')"
```

Expected: sin salida, exit code 0 (la SQL real se verifica contra la base de datos en el Task final).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0053_tiktok_trivia.sql
git commit -m "$(cat <<'EOF'
feat: add tiktok_trivia_sesiones and tiktok_trivia_respuestas migration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Variables de entorno del bridge

**Files:**
- Modify: `.env.local`
- Modify: `.env.example`

- [ ] **Step 1: Agregar a `.env.local`**

Agregar al final del archivo:

```bash
# Bridge de trivia por TikTok Live — ver tiktok-trivia-bridge/ (proyecto
# separado, desplegado en el VPS). La URL y la clave deben coincidir con
# las que corren ahí.
ELIM_TIKTOK_BRIDGE_WS_URL=wss://radio.elimlldm.net/live-tiktok-trivia/
ELIM_TIKTOK_BRIDGE_KEY=placeholder-tiktok-trivia-bridge-key
```

La ruta exacta del WS (`/live-tiktok-trivia/`) es un valor de partida — al desplegar el bridge (Task final) confirmar contra la configuración real del proxy del VPS y ajustar aquí si es distinta.

- [ ] **Step 2: Agregar a `.env.example`**

```bash
# Bridge de trivia por TikTok Live (proyecto separado tiktok-trivia-bridge/)
ELIM_TIKTOK_BRIDGE_WS_URL=
ELIM_TIKTOK_BRIDGE_KEY=
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
docs: document ELIM_TIKTOK_BRIDGE env vars in .env.example

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

`.env.local` no se commitea (ya está en `.gitignore` del repo).

---

### Task 6: Helper de conexión WebSocket (`bridge-client.ts`)

**Files:**
- Create: `src/lib/tiktok-trivia/bridge-client.ts`

- [ ] **Step 1: Escribir el archivo**

```typescript
export type TikTokTriviaBridgeMessage =
  | { type: "connected" }
  | { type: "winner"; tiktokUsername: string; tiktokDisplayName: string; answer: "a" | "b" | "c" | "d"; ts: number }
  | { type: "error"; reason?: "not_live" | "tiktok_disconnected" | "connect_failed"; message?: string };

/**
 * Conecta al bridge de trivia de TikTok y resuelve cuando confirma la
 * conexión con "ready" — mismo patrón que connectRadioBridge() en
 * src/lib/radio-broadcast.ts, pero para un servicio distinto.
 */
export function connectTikTokTriviaBridge(wsUrl: string, key: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    const onMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; message?: string };
        if (msg.type === "ready") {
          ws.removeEventListener("message", onMessage);
          ws.removeEventListener("close", onClose);
          resolve(ws);
        } else if (msg.type === "error") {
          ws.removeEventListener("message", onMessage);
          ws.removeEventListener("close", onClose);
          reject(new Error(msg.message ?? "El bridge de trivia de TikTok rechazó la conexión"));
          ws.close();
        }
      } catch {
        // ignora mensajes no-JSON (no deberían llegar antes de "ready")
      }
    };

    const onClose = () => reject(new Error("La conexión se cerró antes de confirmarse"));

    ws.addEventListener("message", onMessage);
    ws.addEventListener("close", onClose);
    ws.addEventListener("error", () => {
      reject(new Error("No se pudo conectar al bridge de trivia de TikTok"));
      ws.close();
    });
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "hello", key }));
    });
  });
}

export function sendBridgeMessage(ws: WebSocket, msg: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
```

- [ ] **Step 2: Type-check**

```bash
cd /c/Users/arturooq/elim-lldm
npx tsc --noEmit
```

Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tiktok-trivia/bridge-client.ts
git commit -m "$(cat <<'EOF'
feat: add browser-side WebSocket client for the TikTok trivia bridge

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Ruta `POST /api/tiktok-trivia/bridge-credentials`

**Files:**
- Create: `src/app/api/tiktok-trivia/bridge-credentials/route.ts`

- [ ] **Step 1: Escribir la ruta**

```typescript
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";

export async function POST() {
  const profile = await getProfile();

  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin" && profile.role !== "anfitrion") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wsUrl = process.env.ELIM_TIKTOK_BRIDGE_WS_URL;
  const key = process.env.ELIM_TIKTOK_BRIDGE_KEY;

  if (!wsUrl || !key) {
    return NextResponse.json({ error: "El bridge de trivia de TikTok no está configurado" }, { status: 503 });
  }

  return NextResponse.json({ wsUrl, key });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: sin errores nuevos.

- [ ] **Step 3: Verificar contra un dev server local**

```bash
npm run dev
```

En otra terminal:

```bash
curl -i -X POST http://localhost:3000/api/tiktok-trivia/bridge-credentials
```

Expected: `HTTP/1.1 401` con `{"error":"Unauthorized"}` (sin cookie de sesión) — confirma que la ruta y el gate de auth están conectados. Los caminos 403/503/200 se verifican en el Task final con una sesión real.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tiktok-trivia/bridge-credentials/route.ts
git commit -m "$(cat <<'EOF'
feat: add bridge-credentials route for TikTok trivia

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `TikTokAnswerDisplay` — opciones A/B/C/D no interactivas

**Files:**
- Create: `src/components/tiktok-trivia/TikTokAnswerDisplay.tsx`

- [ ] **Step 1: Escribir el componente**

```tsx
import { Check, Trophy } from "lucide-react";
import type { AnswerOption } from "@/types";

interface TikTokAnswerDisplayProps {
  opciones: { a: string; b: string; c: string; d: string };
  correct: AnswerOption | null;
  winnerAnswer: AnswerOption | null;
}

const LABELS: Record<AnswerOption, string> = { a: "A", b: "B", c: "C", d: "D" };

const COLORS: Record<AnswerOption, string> = {
  a: "#EF4444",
  b: "#3B82F6",
  c: "#22C55E",
  d: "#EAB308",
};

export function TikTokAnswerDisplay({ opciones, correct, winnerAnswer }: TikTokAnswerDisplayProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {(Object.keys(opciones) as AnswerOption[]).map((key) => {
        const color = COLORS[key];
        const isCorrect = correct === key;
        const isRevealing = correct !== null;
        const isWinnerAnswer = winnerAnswer === key;

        return (
          <div
            key={key}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl transition-all duration-200"
            style={{
              background: color,
              color: "#fff",
              opacity: isRevealing && !isCorrect ? 0.4 : 1,
              border: isCorrect ? "3px solid #fff" : "3px solid transparent",
            }}
          >
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-extrabold shrink-0"
              style={{ background: "rgba(0,0,0,0.2)" }}
            >
              {LABELS[key]}
            </span>
            <span className="flex-1 text-lg font-bold leading-snug">{opciones[key]}</span>
            {isWinnerAnswer && <Trophy size={22} className="shrink-0" />}
            {isRevealing && isCorrect && <Check size={24} className="shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/tiktok-trivia/TikTokAnswerDisplay.tsx
git commit -m "$(cat <<'EOF'
feat: add non-interactive A/B/C/D display for TikTok trivia

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `TikTokTriviaLeaderboard`

**Files:**
- Create: `src/components/tiktok-trivia/TikTokTriviaLeaderboard.tsx`

- [ ] **Step 1: Escribir el componente**

```tsx
export interface TikTokLeaderboardEntry {
  tiktokUsername: string;
  tiktokDisplayName: string;
  points: number;
}

interface TikTokTriviaLeaderboardProps {
  entries: TikTokLeaderboardEntry[];
}

export function TikTokTriviaLeaderboard({ entries }: TikTokTriviaLeaderboardProps) {
  const sorted = [...entries].sort((a, b) => b.points - a.points);

  if (sorted.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Todavía nadie ha acertado ninguna pregunta.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((entry, index) => (
        <div
          key={entry.tiktokUsername}
          className="flex items-center justify-between px-4 py-2.5 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold w-5" style={{ color: "var(--color-text-muted)" }}>
              {index + 1}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {entry.tiktokDisplayName}
              </span>
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                @{entry.tiktokUsername}
              </span>
            </div>
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
            {entry.points} pts
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/tiktok-trivia/TikTokTriviaLeaderboard.tsx
git commit -m "$(cat <<'EOF'
feat: add TikTok trivia leaderboard component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `TikTokTriviaResults` — pantalla final con podio

**Files:**
- Create: `src/components/tiktok-trivia/TikTokTriviaResults.tsx`

- [ ] **Step 1: Escribir el componente**

```tsx
"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";
import { TikTokTriviaLeaderboard, type TikTokLeaderboardEntry } from "./TikTokTriviaLeaderboard";

interface TikTokTriviaResultsProps {
  entries: TikTokLeaderboardEntry[];
  onTerminar: () => void;
}

export function TikTokTriviaResults({ entries, onTerminar }: TikTokTriviaResultsProps) {
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  const winner = sorted[0];

  useEffect(() => {
    const duration = 2500;
    const end = Date.now() + duration;
    const colors = ["#D4A017", "#EDB84A", "#FFFFFF"];
    let frameId: number;

    function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) frameId = requestAnimationFrame(frame);
    }

    frame();
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center gap-6 py-8">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
      >
        <Trophy size={40} style={{ color: "var(--color-primary)" }} />
      </div>

      <div className="text-center flex flex-col gap-2">
        <p
          className="text-sm font-semibold uppercase"
          style={{ color: "var(--color-text-muted)", letterSpacing: "0.1em" }}
        >
          ¡Trivia terminada!
        </p>
        {winner ? (
          <h1 className="text-3xl font-extrabold" style={{ color: "var(--color-primary)" }}>
            {winner.tiktokDisplayName}
          </h1>
        ) : (
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Nadie acertó ninguna pregunta
          </h1>
        )}
        {winner && (
          <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
            con{" "}
            <span className="font-bold" style={{ color: "var(--color-text)" }}>
              {winner.points} pts
            </span>
          </p>
        )}
      </div>

      <div className="w-full">
        <TikTokTriviaLeaderboard entries={entries} />
      </div>

      <button
        onClick={onTerminar}
        className="px-5 py-3 rounded-xl text-sm font-semibold"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        Terminar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/tiktok-trivia/TikTokTriviaResults.tsx
git commit -m "$(cat <<'EOF'
feat: add TikTok trivia results screen with confetti

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `TikTokTriviaControl` — orquestador de las 3 pantallas

Este es el componente central: maneja la conexión al bridge, el ciclo de vida de cada pregunta, y la persistencia en Supabase.

**Files:**
- Create: `src/components/tiktok-trivia/TikTokTriviaControl.tsx`

- [ ] **Step 1: Escribir el componente**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createFreshClient } from "@/lib/supabase/client";
import { connectTikTokTriviaBridge, sendBridgeMessage } from "@/lib/tiktok-trivia/bridge-client";
import { TikTokAnswerDisplay } from "./TikTokAnswerDisplay";
import { TikTokTriviaLeaderboard, type TikTokLeaderboardEntry } from "./TikTokTriviaLeaderboard";
import { TikTokTriviaResults } from "./TikTokTriviaResults";
import type { Question, AnswerOption } from "@/types";

interface QuestionSetOption {
  id: string;
  title: string;
  count: number;
}

type Screen = "configurar" | "en_vivo" | "resultados";
type BridgeStatus = "idle" | "connecting" | "connected" | "error";
type QuestionPhase = "pending" | "open" | "revealed";

interface WinnerInfo {
  username: string;
  displayName: string;
  answer: AnswerOption;
}

interface TikTokTriviaControlProps {
  questionSets: QuestionSetOption[];
}

export function TikTokTriviaControl({ questionSets }: TikTokTriviaControlProps) {
  const [screen, setScreen] = useState<Screen>("configurar");
  const [selectedSetId, setSelectedSetId] = useState(questionSets[0]?.id ?? "");
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionPhase, setQuestionPhase] = useState<QuestionPhase>("pending");
  const [winner, setWinner] = useState<WinnerInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<Map<string, TikTokLeaderboardEntry>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const sesionIdRef = useRef<string | null>(null);
  const intentionalCloseRef = useRef(false);
  const questionsRef = useRef<Question[]>([]);
  const questionIndexRef = useRef(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reflejados en refs para que el listener de "message" del WebSocket
  // (registrado una sola vez en conectar()) siempre lea el valor actual
  // en vez de quedar atado al valor que tenían al momento de registrarse.
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    questionIndexRef.current = questionIndex;
  }, [questionIndex]);

  const currentQuestion = questions[questionIndex] ?? null;

  function bumpLeaderboard(username: string, displayName: string) {
    setLeaderboard((prev) => {
      const next = new Map(prev);
      const existing = next.get(username);
      next.set(username, {
        tiktokUsername: username,
        tiktokDisplayName: displayName,
        points: (existing?.points ?? 0) + 1,
      });
      return next;
    });
  }

  async function handleBridgeMessage(msg: {
    type: string;
    reason?: string;
    tiktokUsername?: string;
    tiktokDisplayName?: string;
    answer?: AnswerOption;
  }) {
    if (msg.type === "connected") {
      reconnectAttemptsRef.current = 0;
      setBridgeStatus("connected");
      setErrorMsg("");
      setScreen("en_vivo");
      const supabase = createFreshClient();
      if (sesionIdRef.current) {
        await supabase.from("tiktok_trivia_sesiones").update({ status: "en_vivo" }).eq("id", sesionIdRef.current);
      }
    } else if (msg.type === "error") {
      setBridgeStatus("error");
      setErrorMsg(
        msg.reason === "not_live"
          ? "La cuenta no está en vivo en TikTok ahora mismo."
          : msg.reason === "tiktok_disconnected"
            ? "Se perdió la conexión con TikTok (el bridge sigue conectado)."
            : "Ocurrió un error en el bridge de TikTok."
      );
    } else if (msg.type === "winner" && msg.tiktokUsername && msg.tiktokDisplayName && msg.answer) {
      setWinner({ username: msg.tiktokUsername, displayName: msg.tiktokDisplayName, answer: msg.answer });
      bumpLeaderboard(msg.tiktokUsername, msg.tiktokDisplayName);

      const question = questionsRef.current[questionIndexRef.current];
      if (sesionIdRef.current && question) {
        const supabase = createFreshClient();
        await supabase.from("tiktok_trivia_respuestas").insert({
          sesion_id: sesionIdRef.current,
          question_id: question.id,
          tiktok_username: msg.tiktokUsername,
          tiktok_display_name: msg.tiktokDisplayName,
        });
      }
    }
  }

  /** Escucha compartida entre la primera conexión y cada reintento automático. */
  function attachSocket(ws: WebSocket) {
    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        void handleBridgeMessage(msg);
      } catch {
        // ignora mensajes no-JSON
      }
    });

    ws.addEventListener("close", () => {
      if (wsRef.current !== ws || intentionalCloseRef.current) return;
      wsRef.current = null;
      scheduleReconnect("Se perdió la conexión con el bridge de TikTok.");
    });
  }

  /**
   * Reintento automático acotado a 5 intentos con 3s de espera entre cada
   * uno — cubre una caída pasajera del WebSocket con el bridge sin
   * reiniciar la sesión (misma sesionId, mismas preguntas, mismo índice).
   * Tras 5 intentos fallidos, deja el error fijo y regresa a "Configurar"
   * para que el host reconecte a mano.
   */
  function scheduleReconnect(message: string) {
    if (intentionalCloseRef.current) return;
    reconnectAttemptsRef.current += 1;
    if (reconnectAttemptsRef.current > 5) {
      setBridgeStatus("error");
      setErrorMsg(`${message} Intenta conectar de nuevo.`);
      setScreen("configurar");
      return;
    }
    setBridgeStatus("connecting");
    setErrorMsg(`${message} Reconectando… (intento ${reconnectAttemptsRef.current} de 5)`);
    reconnectTimeoutRef.current = setTimeout(() => void reconectar(), 3000);
  }

  /** Reconecta reusando la sesión ya creada — no inserta una fila nueva ni reinicia las preguntas. */
  async function reconectar() {
    if (intentionalCloseRef.current) return;
    try {
      const res = await fetch("/api/tiktok-trivia/bridge-credentials", { method: "POST" });
      const creds = await res.json();
      if (!res.ok) throw new Error(creds.error ?? "No se pudo obtener las credenciales del bridge");

      const ws = await connectTikTokTriviaBridge(creds.wsUrl, creds.key);
      wsRef.current = ws;
      attachSocket(ws);
      sendBridgeMessage(ws, { type: "start_session" });
    } catch (err) {
      scheduleReconnect(err instanceof Error ? err.message : "No se pudo reconectar.");
    }
  }

  async function conectar() {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectAttemptsRef.current = 0;
    setErrorMsg("");
    setBridgeStatus("connecting");
    intentionalCloseRef.current = false;

    try {
      const supabase = createFreshClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión expirada, vuelve a iniciar sesión.");

      const { data: preguntas, error: preguntasError } = await supabase
        .from("questions")
        .select("*")
        .eq("question_set_id", selectedSetId)
        .order("order_index");
      if (preguntasError) throw preguntasError;
      if (!preguntas || preguntas.length === 0) throw new Error("Ese set no tiene preguntas.");

      const res = await fetch("/api/tiktok-trivia/bridge-credentials", { method: "POST" });
      const creds = await res.json();
      if (!res.ok) throw new Error(creds.error ?? "No se pudo obtener las credenciales del bridge");

      const ws = await connectTikTokTriviaBridge(creds.wsUrl, creds.key);
      wsRef.current = ws;
      attachSocket(ws);

      const { data: sesion, error: sesionError } = await supabase
        .from("tiktok_trivia_sesiones")
        .insert({ question_set_id: selectedSetId, started_by: user.id, status: "conectando" })
        .select("id")
        .single();
      if (sesionError) throw sesionError;
      sesionIdRef.current = sesion.id;

      setQuestions(preguntas as Question[]);
      setQuestionIndex(0);
      setQuestionPhase("pending");
      sendBridgeMessage(ws, { type: "start_session" });
    } catch (err) {
      wsRef.current?.close();
      wsRef.current = null;
      setBridgeStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "No se pudo conectar");
    }
  }

  function mostrarPregunta() {
    if (!currentQuestion || !wsRef.current) return;
    setWinner(null);
    setQuestionPhase("open");
    sendBridgeMessage(wsRef.current, {
      type: "open_question",
      questionId: currentQuestion.id,
      correctOption: currentQuestion.correct_option,
    });
  }

  function revelarRespuesta() {
    if (!wsRef.current) return;
    setQuestionPhase("revealed");
    sendBridgeMessage(wsRef.current, { type: "close_question" });
  }

  async function siguientePreguntaOTerminar() {
    if (questionIndex + 1 < questions.length) {
      setWinner(null);
      setQuestionPhase("pending");
      setQuestionIndex((i) => i + 1);
    } else {
      await terminar();
    }
  }

  async function terminar() {
    intentionalCloseRef.current = true;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      sendBridgeMessage(wsRef.current, { type: "end_session" });
      wsRef.current.close();
      wsRef.current = null;
    }
    const supabase = createFreshClient();
    if (sesionIdRef.current) {
      await supabase
        .from("tiktok_trivia_sesiones")
        .update({ status: "finalizada", ended_at: new Date().toISOString() })
        .eq("id", sesionIdRef.current);
    }
    setScreen("resultados");
  }

  const leaderboardEntries = Array.from(leaderboard.values());

  if (screen === "resultados") {
    return <TikTokTriviaResults entries={leaderboardEntries} onTerminar={() => window.location.reload()} />;
  }

  if (screen === "en_vivo" && currentQuestion) {
    const opciones = {
      a: currentQuestion.option_a,
      b: currentQuestion.option_b,
      c: currentQuestion.option_c,
      d: currentQuestion.option_d,
    };

    return (
      <div className="flex flex-col gap-6">
        {errorMsg && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "var(--color-destructive)",
            }}
          >
            {errorMsg}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Pregunta {questionIndex + 1} de {questions.length}
          </span>
          {winner && (
            <span className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
              🏆 @{winner.username} acertó con {winner.answer.toUpperCase()}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          {currentQuestion.question_text}
        </h2>
        <TikTokAnswerDisplay
          opciones={opciones}
          correct={questionPhase === "revealed" ? currentQuestion.correct_option : null}
          winnerAnswer={winner?.answer ?? null}
        />
        <div className="flex gap-3">
          {questionPhase === "pending" && (
            <button
              onClick={mostrarPregunta}
              className="flex-1 px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              Mostrar pregunta
            </button>
          )}
          {questionPhase === "open" && (
            <button
              onClick={revelarRespuesta}
              className="flex-1 px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              Revelar respuesta
            </button>
          )}
          {questionPhase === "revealed" && (
            <button
              onClick={() => void siguientePreguntaOTerminar()}
              className="flex-1 px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              {questionIndex + 1 < questions.length ? "Siguiente pregunta" : "Ver resultados"}
            </button>
          )}
        </div>
        <TikTokTriviaLeaderboard entries={leaderboardEntries} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {errorMsg && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "var(--color-destructive)",
          }}
        >
          {errorMsg}
        </div>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          Set de preguntas
        </span>
        <select
          value={selectedSetId}
          onChange={(e) => setSelectedSetId(e.target.value)}
          disabled={bridgeStatus === "connecting"}
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        >
          {questionSets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.title} ({set.count} preguntas)
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => void conectar()}
        disabled={bridgeStatus === "connecting" || !selectedSetId}
        className="px-5 py-3 rounded-xl text-sm font-semibold"
        style={{ background: "var(--color-primary)", color: "#000", opacity: bridgeStatus === "connecting" ? 0.6 : 1 }}
      >
        {bridgeStatus === "connecting" ? "Conectando…" : "Conectar a TikTok Live"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: sin errores nuevos. Si aparece un error sobre `Question` o `AnswerOption` no encontrados, confirmar que `src/types/index.ts` los exporta (ya deberían existir — ver Task de investigación previa a este plan).

- [ ] **Step 3: Commit**

```bash
git add src/components/tiktok-trivia/TikTokTriviaControl.tsx
git commit -m "$(cat <<'EOF'
feat: add TikTokTriviaControl orchestrator component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Página `/tiktok-trivia`

**Files:**
- Create: `src/app/(public)/tiktok-trivia/page.tsx`

- [ ] **Step 1: Escribir la página**

```tsx
import { getProfile, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { TikTokTriviaControl } from "@/components/tiktok-trivia/TikTokTriviaControl";

export const metadata: Metadata = { title: "Trivia TikTok — Elim LLDM" };

export default async function TikTokTriviaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/tiktok-trivia");
  if (profile.role !== "admin" && profile.role !== "anfitrion") {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: questionSets } = await supabase
    .from("question_sets")
    .select("id, title, questions(count)")
    .eq("is_public", true)
    .order("title");

  const sets = (questionSets ?? []).map((s) => ({
    id: s.id as string,
    title: s.title as string,
    count: ((s.questions as unknown as { count: number }[])[0]?.count) ?? 0,
  }));

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
          Trivia en vivo por TikTok
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
          Los espectadores responden comentando A, B, C o D directo en tu TikTok Live.
        </p>
        <TikTokTriviaControl questionSets={sets} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: sin errores nuevos.

- [ ] **Step 3: Verificar contra un dev server local**

```bash
npm run dev
```

Visitar `http://localhost:3000/tiktok-trivia` sin sesión iniciada.

Expected: redirige a `/login?returnUrl=/tiktok-trivia`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/tiktok-trivia/page.tsx"
git commit -m "$(cat <<'EOF'
feat: add /tiktok-trivia control page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Build completo de `elim-lldm`

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Limpiar `.next` y hacer build de producción**

```bash
cd /c/Users/arturooq/elim-lldm
rm -rf .next
npm run build
```

Expected: build termina sin errores. Si falla por algo no relacionado con los archivos de este plan (código preexistente), anotarlo y seguir — si falla por algo de los archivos nuevos, arreglarlo antes de continuar.

- [ ] **Step 2: Build del bridge**

```bash
cd /c/Users/arturooq/tiktok-trivia-bridge
npm run build
```

Expected: sin errores, genera `dist/`.

---

### Task 14: Desplegar, aplicar migración y verificar en vivo

Este es el único paso con efectos reales y difíciles de revertir (escribir en la base de datos de producción, desplegar un servicio nuevo en el VPS, y — la parte más delicada — conectarse de verdad al TikTok Live oficial de Elim LLDM). Confirmar con el usuario antes de cada sub-paso si algo se ve inesperado.

**Files:** ninguno (solo infra/deploy).

- [ ] **Step 1: Subir `elim-lldm`**

```bash
cd /c/Users/arturooq/elim-lldm
git push origin master
```

Expected: Vercel arranca un deploy de producción automáticamente.

- [ ] **Step 2: Configurar `ELIM_TIKTOK_BRIDGE_WS_URL`/`ELIM_TIKTOK_BRIDGE_KEY` en Vercel**

Pedir al usuario que agregue las mismas dos variables (con los valores reales, no los placeholders de `.env.local`) en el dashboard de Vercel del proyecto `elim-lldm`, en Production — igual que se hizo con `ZOHO_SMTP_*` — y que redeploye después de guardarlas.

- [ ] **Step 3: Aplicar la migración a producción**

Per `feedback_supabase_sql_editor_workflow` (memoria del proyecto): cualquier escritura directa a la base de datos de producción es bloqueada por el clasificador de auto-mode de Claude Code, incluso con confirmación explícita en el chat. Pedir al usuario que corra, desde su propio clon local de `elim-lldm` (el que tiene `SUPABASE_ACCESS_TOKEN` en `.env.local` y el proyecto ya enlazado):

```
!npx supabase db push
```

- [ ] **Step 4: Verificar que la migración llegó**

```bash
SR=$(grep -E "^SUPABASE_SERVICE_ROLE_KEY=" .env.local | cut -d= -f2-)
curl -s -o /dev/null -w "HTTP_%{http_code}\n" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/tiktok_trivia_sesiones?select=id&limit=1" \
  -H "apikey: $SR" -H "Authorization: Bearer $SR"
```

Expected: `HTTP_200` (confirma que la tabla y sus GRANTs existen — un `404`/`42P01` significaría que la migración no se aplicó).

- [ ] **Step 5: Desplegar el bridge al VPS**

Este repo (`tiktok-trivia-bridge`) todavía no existe en el VPS 46.224.234.223. Este agente no tiene acceso de lectura ni escritura por SSH a ese servidor (el clasificador de auto-mode lo bloqueó incluso para un `ls` de solo lectura al escribir este plan) — pedir al usuario que:

1. Copie el proyecto al VPS (`scp -r` o clonándolo desde un remoto que el usuario cree, a su criterio).
2. Cree un `.env` ahí con `TIKTOK_TRIVIA_BRIDGE_KEY` (el mismo valor puesto en `ELIM_TIKTOK_BRIDGE_KEY` de Vercel), `TIKTOK_USERNAME` (el @usuario real de TikTok de Elim LLDM), y opcionalmente `EULERSTREAM_API_KEY`.
3. Corra `npm install && npm run build` ahí.
4. Lo deje corriendo con el mismo gestor de procesos que ya usa para el bridge de radio (pm2, systemd, o el que sea — confirmar cuál usa antes de asumir).
5. Configure el proxy (nginx u otro, el mismo que expone `wss://radio.elimlldm.net/live-elim/` para el bridge de radio) para exponer este servicio nuevo en la ruta usada en `ELIM_TIKTOK_BRIDGE_WS_URL` (Task 5) — si el usuario prefiere otra ruta o puerto, ajustar esa variable de entorno para que coincida.

- [ ] **Step 6: Verificación manual en vivo**

Con el usuario (o guiándolo paso a paso si comparte pantalla):

1. Visitar `/tiktok-trivia` con una cuenta `anfitrion` o `admin` — confirmar que carga (no redirige).
2. Elegir un set de preguntas, clic en "Conectar a TikTok Live" **mientras el usuario esté transmitiendo en vivo de verdad en la cuenta oficial** (o confirmar que sin transmitir aparece el mensaje "La cuenta no está en vivo ahora mismo").
3. Con el live activo: clic en "Mostrar pregunta", pedirle a alguien del público que comente la letra correcta, confirmar que aparece "🏆 @usuario acertó con X" y que la tabla de posiciones lo suma.
4. Clic en "Revelar respuesta" y confirmar que un comentario tardío ya no cuenta.
5. Repetir con las preguntas restantes del set y confirmar que la pantalla de resultados finales muestra el podio correcto con confeti.
6. Confirmar en Supabase (SQL Editor o REST con la service role key) que quedaron filas reales en `tiktok_trivia_sesiones` y `tiktok_trivia_respuestas`.
7. Clic en "Terminar" a medio set y confirmar que el bridge se desconecta de TikTok limpiamente (sin dejar la conexión abierta — se puede confirmar pidiéndole al usuario que revise los logs del proceso en el VPS).

- [ ] **Step 7: Reportar**

Resumir al usuario qué se verificó y cualquier cosa que no haya funcionado — este paso no tiene commit propio.
