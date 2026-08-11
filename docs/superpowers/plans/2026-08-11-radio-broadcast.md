# Salida a radio desde Estudio en Vivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Task 1 and Task 9 are infrastructure/production-deploy tasks — the controller must execute these directly (never delegate to a subagent) and must get explicit user go-ahead before touching the VPS or setting production secrets.**

**Goal:** Let the host of a live "Plática" (Estudio en Vivo) broadcast a live mix of up to three audio sources — their own mic, the rest of the room, and their computer/tab audio — straight to the "Elim LLDM" AzuraCast radio station, replacing a "Salida a radio" button that currently calls a relay service that was never built.

**Architecture:** Reuse a proven WebSocket→ffmpeg→Icecast bridge already running on the AzuraCast VPS for a sibling station (team-desveladoslldm.com), by standing up a second instance of it pointed at the Elim LLDM station. The browser does all the audio work client-side: LiveKit's own React hooks expose room participants' mic tracks, `getDisplayMedia` captures tab/PC audio, the Web Audio API mixes whichever sources are toggled on, and `MediaRecorder` streams the mix to the bridge over a WebSocket — no new server-side relay, no LiveKit Egress, no Railway.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, `@livekit/components-react` + `livekit-client` (already a dependency), Web Audio API (`AudioContext`, `MediaStreamAudioDestinationNode`), `MediaRecorder`, native `WebSocket`, `getDisplayMedia`. On the VPS: Node 18 + `ws` + `ffmpeg` (identical to the existing `tdv-live-bridge` service — no new libraries).

---

## Spec

Full design: `docs/superpowers/specs/2026-08-11-radio-broadcast-design.md`. Key decisions already locked in there — don't relitigate:
- Three independent on/off toggles (no volume sliders): mic, sala completa, audio de PC.
- Only "mic" starts ON when broadcasting begins.
- Visible only to host/admin, only while the plática is live.
- The existing "Salida a radio" button and its dead-end API route are replaced, not left in parallel.
- `platikas.radio_output_active` (already wired to public badges elsewhere) keeps being the source of truth for "is this plática on the radio right now" — only what sets it changes.

## File Structure

| File | Responsibility |
|---|---|
| VPS: AzuraCast + `elim-live-bridge` service + nginx route (not in this repo) | New Streamer/DJ account + bridge instance dedicated to the Elim LLDM station |
| `src/app/api/platikas/[id]/radio-key/route.ts` (create) | Authorizes host/admin of a live plática, hands back the bridge URL + key |
| `src/app/api/platikas/[id]/radio-toggle/route.ts` (delete) | Dead code — called the relay that was never built |
| `src/app/api/platikas/[id]/end/route.ts` (modify) | Remove the dead "stop relay" block |
| `src/lib/radio-broadcast.ts` (create) | Pure helpers: WebSocket handshake, `AudioMixer` class, tab-audio capture, MediaRecorder→WebSocket streaming |
| `src/components/platikas/RadioBroadcastPanel.tsx` (create) | The 3-source mixer UI, replaces the old button |
| `src/components/platikas/HostControls.tsx` (modify) | Swap old radio button for `<RadioBroadcastPanel>` |
| `src/components/platikas/LiveKitRoom.tsx` (modify) | Move `<LKRoom>` to wrap the sidebar too, so `RadioBroadcastPanel` can use LiveKit hooks |
| `src/app/(public)/platikas/[id]/page.tsx` (modify) | Drop the now-unused `radioOutputActive` prop passed into `LiveKitRoom` |

**Note on testing:** no automated test suite in this repo (established convention this session). Each code task's "test" step is `pnpm exec tsc --noEmit`, plus a manual browser verification pass at the end (Task 8) and a manual live-audio check against the real bridge once VPS infra is up (Task 9).

---

### Task 1: VPS infrastructure — new AzuraCast Streamer/DJ account + bridge instance

**Do not start this task without the user's explicit go-ahead in chat — it creates real credentials and a new service on a shared production server.** Execute directly via the SSH access already verified this session (`ssh root@46.224.234.223`) — do not delegate.

- [ ] **Step 1: Generate a new password and its AzuraCast-compatible hash**

```bash
NEWPASS=$(openssl rand -base64 18 | tr -d '=+/')
echo "Nueva contraseña streamer Elim LLDM: $NEWPASS"
ssh root@46.224.234.223 "docker exec azuracast php -r \"echo password_hash('$NEWPASS', PASSWORD_ARGON2ID, ['memory_cost'=>65536,'time_cost'=>4,'threads'=>1]);\""
```

Save both the plaintext (`NEWPASS`, needed for the docker-compose env var in Step 3) and the hash (needed for the SQL insert in Step 2).

- [ ] **Step 2: Check the `station_streamers` schema, then insert the new account**

```bash
ssh root@46.224.234.223 "docker exec azuracast mariadb -u azuracast -pyDFdYQRexFwr azuracast -e 'DESCRIBE station_streamers;'"
```

Using the actual column list from that output (there will likely be `comments`, `art`, `created_at`, `updated_at` columns beyond the ones already confirmed — `id, station_id, streamer_username, streamer_password, display_name, is_active`), insert a row for station 2 (Elim LLDM) with `streamer_username='estudio_elim'`, the argon2id hash from Step 1, `display_name='Elim LLDM Estudio'`, `is_active=1`, and reasonable defaults/NULLs for the rest. Example shape (adjust once the real column list is known):

```bash
ssh root@46.224.234.223 "docker exec azuracast mariadb -u azuracast -pyDFdYQRexFwr azuracast -e \"INSERT INTO station_streamers (station_id, streamer_username, streamer_password, display_name, is_active, created_at, updated_at) VALUES (2, 'estudio_elim', '<HASH_FROM_STEP_1>', 'Elim LLDM Estudio', 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());\""
```

Verify it landed:

```bash
ssh root@46.224.234.223 "docker exec azuracast mariadb -u azuracast -pyDFdYQRexFwr azuracast -e \"SELECT id, station_id, streamer_username, display_name, is_active FROM station_streamers WHERE station_id=2;\""
```

- [ ] **Step 3: Add the new bridge service to docker-compose.yml**

```bash
ssh root@46.224.234.223 "cat /root/live-bridge-azuracast/docker-compose.yml"
```

Add a new service block (copy of `tdv-live-bridge`, same image/volumes/command, different name/env/network membership stays the same):

```yaml
  elim-live-bridge:
    image: node:18-alpine
    container_name: elim-live-bridge
    working_dir: /app
    volumes:
      - .:/app
    command: sh -c "apk add --no-cache ffmpeg && npm install && npm start"
    environment:
      - BRIDGE_KEY=<GENERATE_A_NEW_RANDOM_KEY_HERE>
      - ICECAST_URL=icecast://estudio_elim:<NEWPASS_FROM_STEP_1>@172.19.0.3:8015/
    restart: unless-stopped
    networks:
      - azuracast_default
```

Generate the new `BRIDGE_KEY` the same way as the password (`openssl rand -base64 24 | tr -d '=+/'`). Append this block to the existing file (don't touch the other three services), then:

```bash
ssh root@46.224.234.223 "cd /root/live-bridge-azuracast && docker compose up -d elim-live-bridge"
ssh root@46.224.234.223 "docker logs elim-live-bridge --tail 30"
```

Expected log line: `TDV live bridge escuchando en :8080 → 172.19.0.3:8015/` (the log message is hardcoded/generic in `server.js` — that's fine, it's the same script).

- [ ] **Step 4: Expose it via nginx**

```bash
ssh root@46.224.234.223 "docker exec azuracast cat /etc/nginx/azuracast.conf.d/live-bridge.conf"
```

Create a new conf file `/etc/nginx/azuracast.conf.d/live-bridge-elim.conf` inside the `azuracast` container with the same shape, pointed at the new container and a new path:

```nginx
location ^~ /live-elim/ {
    add_header "Access-Control-Allow-Origin" "*" always;
    add_header "Access-Control-Allow-Methods" "GET, POST, OPTIONS" always;
    add_header "Access-Control-Allow-Headers" "Content-Type, Authorization" always;
    if ($request_method = OPTIONS) {
        return 204;
    }

    proxy_pass http://elim-live-bridge:8080/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600;
    proxy_send_timeout 3600;
}
```

```bash
ssh root@46.224.234.223 "docker exec azuracast sh -c 'cat > /etc/nginx/azuracast.conf.d/live-bridge-elim.conf' " <<'EOF'
<paste the block above>
EOF
ssh root@46.224.234.223 "docker exec azuracast nginx -t && docker exec azuracast nginx -s reload"
```

- [ ] **Step 5: Confirm reachability from outside**

```bash
ssh root@46.224.234.223 "curl -s -o /dev/null -w '%{http_code}\n' -H 'Connection: Upgrade' -H 'Upgrade: websocket' https://radio.elimlldm.net/live-elim/"
```

A `101` or `400`/`426` (rejected because curl isn't a real WebSocket client, but reaching nginx→the container) confirms routing works; a `502`/`504` means the container or proxy_pass target is wrong — check `docker logs elim-live-bridge` and the nginx conf.

- [ ] **Step 6: Report the two secrets back**

Report the plaintext `NEWPASS` is no longer needed (only the hash and the running container matter now) and report the **`BRIDGE_KEY`** value — it's needed for Task 9 (setting it as a Vercel env var). Do not commit it to the repo or the plan file.

---

### Task 2: `radio-key` authorization route

**Files:**
- Create: `src/app/api/platikas/[id]/radio-key/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pláticas } = await supabase
    .from("platikas")
    .select("*")
    .eq("id", id)
    .single();

  if (!pláticas) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pláticas.status !== "live") {
    return NextResponse.json({ error: "Pláticas not live" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isHost = pláticas.host_id === user.id;
  const isAdmin = profile?.role === "admin";
  if (!isHost && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const wsUrl = process.env.ELIM_RADIO_BRIDGE_WS_URL;
  const key = process.env.ELIM_RADIO_BRIDGE_KEY;

  if (!wsUrl || !key) {
    return NextResponse.json({ error: "Radio bridge not configured" }, { status: 503 });
  }

  return NextResponse.json({ wsUrl, key });
}
```

- [ ] **Step 2: Add the two new env vars to `.env.example`**

Find `RELAY_SERVICE_URL` / `RELAY_SERVICE_SECRET` in `.env.example` (or wherever this project documents env vars — check `.env.local` first for the current pattern) and add, documented the same way:

```
ELIM_RADIO_BRIDGE_WS_URL=wss://radio.elimlldm.net/live-elim/
ELIM_RADIO_BRIDGE_KEY=placeholder-radio-bridge-key
```

These stay as placeholders in `.env.local`/`.env.example`; the real `ELIM_RADIO_BRIDGE_KEY` (from Task 1, Step 6) only ever gets set in Vercel's production env vars (Task 9) — never committed.

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/platikas/[id]/radio-key/route.ts .env.local
git commit -m "Add radio-key route to authorize live radio broadcasting"
```

(If `.env.example` doesn't exist as a separate tracked file and only `.env.local` — which is likely gitignored — documents env vars, skip committing an env file; note in the commit body that the two new vars need to be set in Vercel.)

---

### Task 3: Remove the dead relay code

**Files:**
- Delete: `src/app/api/platikas/[id]/radio-toggle/route.ts`
- Modify: `src/app/api/platikas/[id]/end/route.ts`

- [ ] **Step 1: Delete the old route**

```bash
git rm src/app/api/platikas/[id]/radio-toggle/route.ts
```

- [ ] **Step 2: Remove the dead "stop relay" block from `end/route.ts`**

Current content around the block to remove:

```typescript
  // Stop relay if active
  if (pláticas.radio_output_active && process.env.RELAY_SERVICE_URL) {
    try {
      await fetch(`${process.env.RELAY_SERVICE_URL}/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RELAY_SERVICE_SECRET}`,
        },
        body: JSON.stringify({ roomName: pláticas.livekit_room_name }),
      });
    } catch {
      // Best effort
    }
  }

  await supabase
```

Remove the whole `// Stop relay if active` block (the `if (pláticas.radio_output_active...) { ... }` statement), leaving:

```typescript
  await supabase
```

directly following the "Delete LiveKit room" block that precedes it. The rest of the file (the final `.update({...})` call that already sets `radio_output_active: false`) stays exactly as-is — that update is still correct and needed regardless of this change, since `RadioBroadcastPanel`'s own cleanup only fires client-side and the plática-end flow should still force the flag off server-side as a safety net.

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add -A src/app/api/platikas/
git commit -m "Remove dead LiveKit-to-radio relay code"
```

---

### Task 4: `radio-broadcast.ts` helpers

**Files:**
- Create: `src/lib/radio-broadcast.ts`

- [ ] **Step 1: Write the helpers**

```typescript
export function connectRadioBridge(wsUrl: string, key: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    const onMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; message?: string };
        if (msg.type === "ready") {
          ws.removeEventListener("message", onMessage);
          resolve(ws);
        } else if (msg.type === "error") {
          ws.removeEventListener("message", onMessage);
          reject(new Error(msg.message ?? "El bridge de radio rechazó la conexión"));
          ws.close();
        }
      } catch {
        // ignora mensajes no-JSON (no deberían llegar antes de "ready")
      }
    };

    ws.addEventListener("message", onMessage);
    ws.addEventListener("error", () => reject(new Error("No se pudo conectar al bridge de radio")));
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "hello", key }));
    });
  });
}

export class AudioMixer {
  readonly context: AudioContext;
  readonly destination: MediaStreamAudioDestinationNode;
  private sources = new Map<string, MediaStreamAudioSourceNode>();

  constructor() {
    this.context = new AudioContext();
    this.destination = this.context.createMediaStreamDestination();
  }

  connect(key: string, stream: MediaStream) {
    if (this.sources.has(key)) return;
    const source = this.context.createMediaStreamSource(stream);
    source.connect(this.destination);
    this.sources.set(key, source);
  }

  disconnect(key: string) {
    const source = this.sources.get(key);
    if (!source) return;
    source.disconnect();
    this.sources.delete(key);
  }

  has(key: string): boolean {
    return this.sources.has(key);
  }

  close() {
    this.sources.forEach((source) => source.disconnect());
    this.sources.clear();
    void this.context.close();
  }
}

export async function captureTabAudio(): Promise<MediaStreamTrack> {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  const audioTracks = displayStream.getAudioTracks();
  displayStream.getVideoTracks().forEach((track) => track.stop());

  if (audioTracks.length === 0) {
    throw new Error("No se compartió audio. Vuelve a intentar y marca la casilla de compartir audio de la pestaña/pantalla.");
  }

  return audioTracks[0];
}

function pickBroadcastMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function startStreamingToBridge(stream: MediaStream, ws: WebSocket): MediaRecorder {
  const mimeType = pickBroadcastMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
      ws.send(e.data);
    }
  };

  recorder.start(250);
  return recorder;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/radio-broadcast.ts
git commit -m "Add radio broadcast helpers: bridge handshake, audio mixer, tab capture"
```

---

### Task 5: `RadioBroadcastPanel` component

**Files:**
- Create: `src/components/platikas/RadioBroadcastPanel.tsx`

This must be rendered as a descendant of `<LKRoom>` (LiveKit's context provider) to use `useTracks` — that's what Task 7 sets up. Written now, wired in during Task 6/7.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Radio, Mic, Users, MonitorSpeaker, Loader2, AlertCircle, Square } from "lucide-react";
import {
  AudioMixer,
  captureTabAudio,
  connectRadioBridge,
  startStreamingToBridge,
} from "@/lib/radio-broadcast";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "connecting" | "live" | "error";

interface RadioBroadcastPanelProps {
  platikaId: string;
}

export function RadioBroadcastPanel({ platikaId }: RadioBroadcastPanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [roomOn, setRoomOn] = useState(false);
  const [pcOn, setPcOn] = useState(false);
  const [pcLoading, setPcLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mixerRef = useRef<AudioMixer | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pcTrackRef = useRef<MediaStreamTrack | null>(null);

  const micTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }]);

  function cleanup() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    wsRef.current = null;
    mixerRef.current?.close();
    mixerRef.current = null;
    pcTrackRef.current?.stop();
    pcTrackRef.current = null;
    setMicOn(false);
    setRoomOn(false);
    setPcOn(false);

    const supabase = createClient();
    void supabase.from("platikas").update({ radio_output_active: false }).eq("id", platikaId);
  }

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync mic/room toggles against the live set of LiveKit mic tracks
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || status !== "live") return;

    for (const ref of micTracks) {
      const mediaTrack = ref.publication?.track?.mediaStreamTrack;
      if (!mediaTrack) continue;
      const key = `livekit-${ref.participant.sid}`;
      const shouldBeOn = ref.participant.isLocal ? micOn : roomOn;

      if (shouldBeOn && !mixer.has(key)) {
        mixer.connect(key, new MediaStream([mediaTrack]));
      } else if (!shouldBeOn && mixer.has(key)) {
        mixer.disconnect(key);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micTracks, micOn, roomOn, status]);

  async function startBroadcast() {
    setStatus("connecting");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/platikas/${platikaId}/radio-key`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar la transmisión");

      const ws = await connectRadioBridge(data.wsUrl, data.key);
      wsRef.current = ws;

      const mixer = new AudioMixer();
      mixerRef.current = mixer;
      recorderRef.current = startStreamingToBridge(mixer.destination.stream, ws);

      ws.addEventListener("close", () => {
        if (wsRef.current !== ws) return;
        cleanup();
        setStatus("error");
        setErrorMsg("Se perdió la conexión con la radio.");
      });

      setMicOn(true);
      setStatus("live");

      const supabase = createClient();
      await supabase.from("platikas").update({ radio_output_active: true }).eq("id", platikaId);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "No se pudo conectar con la radio");
    }
  }

  function stopBroadcast() {
    wsRef.current?.close();
    cleanup();
    setStatus("idle");
    setErrorMsg("");
  }

  async function togglePc() {
    const mixer = mixerRef.current;
    if (!mixer) return;

    if (pcOn) {
      mixer.disconnect("pc-audio");
      pcTrackRef.current?.stop();
      pcTrackRef.current = null;
      setPcOn(false);
      return;
    }

    setPcLoading(true);
    try {
      const track = await captureTabAudio();
      pcTrackRef.current = track;
      mixer.connect("pc-audio", new MediaStream([track]));
      track.addEventListener("ended", () => {
        mixer.disconnect("pc-audio");
        pcTrackRef.current = null;
        setPcOn(false);
      });
      setPcOn(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo compartir el audio de la PC");
    } finally {
      setPcLoading(false);
    }
  }

  if (status === "idle" || status === "connecting") {
    return (
      <button
        type="button"
        onClick={startBroadcast}
        disabled={status === "connecting"}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-muted)",
        }}
      >
        {status === "connecting" ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
        {status === "connecting" ? "Conectando…" : "Salida a radio"}
      </button>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "var(--color-destructive)",
          }}
        >
          <AlertCircle size={14} className="shrink-0" />
          {errorMsg}
        </div>
        <button
          type="button"
          onClick={startBroadcast}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <Radio size={14} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.3)" }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
          <Radio size={13} />
          En vivo en la radio
        </span>
        <button type="button" onClick={stopBroadcast} style={{ color: "var(--color-destructive)" }}>
          <Square size={14} />
        </button>
      </div>

      <SourceToggle icon={Mic} label="Mi micrófono" active={micOn} onToggle={() => setMicOn((v) => !v)} />
      <SourceToggle icon={Users} label="Sala completa" active={roomOn} onToggle={() => setRoomOn((v) => !v)} />
      <SourceToggle
        icon={MonitorSpeaker}
        label="Audio de mi PC"
        active={pcOn}
        loading={pcLoading}
        onToggle={togglePc}
      />

      {errorMsg && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {errorMsg}
        </p>
      )}
    </div>
  );
}

function SourceToggle({
  icon: Icon,
  label,
  active,
  loading,
  onToggle,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active: boolean;
  loading?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: active ? "rgba(212,160,23,0.15)" : "var(--color-surface)",
        border: `1px solid ${active ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
        color: active ? "var(--color-primary)" : "var(--color-text-muted)",
      }}
    >
      <span className="flex items-center gap-2">
        <Icon size={13} />
        {label}
      </span>
      {loading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <span
          className="w-8 h-4 rounded-full relative transition-colors"
          style={{ background: active ? "var(--color-primary)" : "var(--color-border)" }}
        >
          <span
            className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
            style={{ left: active ? "18px" : "2px" }}
          />
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0. (This will fail until Task 7 makes `RadioBroadcastPanel` actually reachable inside a `<LKRoom>` tree at runtime — but it must still *typecheck* standalone, since `useTracks` is valid to call syntactically regardless of runtime context. If typecheck fails on `ref.publication?.track?.mediaStreamTrack` or similar LiveKit types, check the installed `livekit-client` version's `TrackPublication`/`Track` type shape — `pnpm ls livekit-client` — and adjust the optional-chaining path to match, don't suppress with `any`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/platikas/RadioBroadcastPanel.tsx
git commit -m "Add RadioBroadcastPanel: mic/room/PC audio mixer to radio bridge"
```

---

### Task 6: Wire `RadioBroadcastPanel` into `HostControls`

**Files:**
- Modify: `src/components/platikas/HostControls.tsx`

- [ ] **Step 1: Update the icon import**

Change:
```typescript
import { Radio, StopCircle, Mic, MicOff, Loader2, PlaySquare, Globe, Music2 } from "lucide-react";
```
to:
```typescript
import { StopCircle, Mic, Loader2, PlaySquare, Globe, Music2 } from "lucide-react";
```
(`Radio` and `MicOff` were only used by the button this task removes.)

- [ ] **Step 2: Add the new import**

Add near the top, with the other local imports:
```typescript
import { RadioBroadcastPanel } from "./RadioBroadcastPanel";
```

- [ ] **Step 3: Drop the `radioOutputActive` prop and `radioActive` state**

Change:
```typescript
interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  radioOutputActive: boolean;
  onGoLive?: () => void;
  onEnd?: () => void;
  onSpeakerApproved?: (token: string, wsUrl: string) => void;
}

export function HostControls({
  platikaId,
  isLive,
  radioOutputActive,
  onGoLive,
  onEnd,
  onSpeakerApproved,
}: HostControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [radioActive, setRadioActive] = useState(radioOutputActive);
```
to:
```typescript
interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  onGoLive?: () => void;
  onEnd?: () => void;
  onSpeakerApproved?: (token: string, wsUrl: string) => void;
}

export function HostControls({
  platikaId,
  isLive,
  onGoLive,
  onEnd,
  onSpeakerApproved,
}: HostControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
```

- [ ] **Step 4: Remove the `toggleRadio` function**

Delete this whole function:
```typescript
  async function toggleRadio() {
    setLoading("radio");
    try {
      const res = await fetch(`/api/platikas/${platikaId}/radio-toggle`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRadioActive(data.radio_output_active);
      }
    } finally {
      setLoading(null);
    }
  }
```

- [ ] **Step 5: Replace the old radio button with the new panel**

Change:
```tsx
          {isLive && (
            <button
              onClick={toggleRadio}
              disabled={loading === "radio"}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: radioActive ? "rgba(212,160,23,0.15)" : "var(--color-surface-elevated)",
                border: `1px solid ${radioActive ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
                color: radioActive ? "var(--color-primary)" : "var(--color-text-muted)",
              }}
            >
              {loading === "radio" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : radioActive ? (
                <Radio size={14} />
              ) : (
                <MicOff size={14} />
              )}
              {radioActive ? "Salida a radio: ON" : "Salida a radio: OFF"}
            </button>
          )}
```
to:
```tsx
          {isLive && <RadioBroadcastPanel platikaId={platikaId} />}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/platikas/HostControls.tsx
git commit -m "Replace dead radio-toggle button with RadioBroadcastPanel"
```

---

### Task 7: Restructure `LiveKitRoom.tsx` so the sidebar can use LiveKit hooks

**Files:**
- Modify: `src/components/platikas/LiveKitRoom.tsx` (full replacement — the restructure touches most of the render logic, safer as one complete file than a partial diff)
- Modify: `src/app/(public)/platikas/[id]/page.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom as LKRoom } from "@livekit/components-react";
import { Loader2, AlertCircle, Mic } from "lucide-react";
import { StagePanel } from "./StagePanel";
import { ChatPanel } from "./ChatPanel";
import { HostControls } from "./HostControls";
import { RequestButton } from "./RequestButton";

interface LiveKitRoomProps {
  platikaId: string;
  roomName: string;
  isHost: boolean;
  isSpeaker: boolean;
  currentUserId: string | null;
}

type TokenState =
  | { status: "loading" }
  | { status: "ready"; token: string; wsUrl?: string }
  | { status: "error"; message: string };

export function LiveKitRoom({
  platikaId,
  roomName,
  isHost,
  isSpeaker,
  currentUserId,
}: LiveKitRoomProps) {
  const [tokenState, setTokenState] = useState<TokenState>({ status: "loading" });
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (!currentUserId) {
      setTokenState({ status: "error", message: "viewer-no-auth" });
      return;
    }

    const role = isHost ? "host" : isSpeaker ? "speaker" : "viewer";

    fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName, participantRole: role }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.token) {
          setTokenState({ status: "ready", token: data.token, wsUrl: data.wsUrl });
        } else {
          setTokenState({ status: "error", message: data.error ?? "Error al conectar" });
        }
      })
      .catch(() => {
        setTokenState({ status: "error", message: "No se pudo obtener el token LiveKit" });
      });
  }, [roomName, currentUserId, isHost, isSpeaker]);

  function handleSpeakerApproved(newToken: string, wsUrl: string) {
    setTokenState({ status: "ready", token: newToken, wsUrl });
  }

  const defaultLkUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "";

  const sidebar = (
    <div className="flex flex-col gap-3 h-full">
      {isHost && (
        <HostControls
          platikaId={platikaId}
          isLive={isLive}
          onGoLive={() => setIsLive(true)}
          onEnd={() => setIsLive(false)}
          onSpeakerApproved={handleSpeakerApproved}
        />
      )}

      <div className="flex-1 min-h-0">
        <ChatPanel
          platikaId={platikaId}
          currentUserId={currentUserId}
          isHost={isHost}
        />
      </div>

      {currentUserId && !isHost && !isSpeaker && (
        <RequestButton platikaId={platikaId} currentUserId={currentUserId} />
      )}
    </div>
  );

  // Unauthenticated viewer: show login prompt + chat in read-only mode
  if (tokenState.status === "error" && tokenState.message === "viewer-no-auth") {
    return (
      <RoomLayout
        stage={
          <div
            className="flex flex-col items-center justify-center h-full rounded-2xl gap-6 p-8"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(212,160,23,0.08)",
                border: "1px solid rgba(212,160,23,0.2)",
              }}
            >
              <Mic size={28} style={{ color: "var(--color-primary)" }} />
            </div>
            <div className="text-center flex flex-col gap-2 max-w-xs">
              <p className="font-semibold text-base" style={{ color: "var(--color-text)" }}>
                Hay una transmisión en vivo
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Inicia sesión para ver el escenario, chatear y solicitar subir al escenario.
              </p>
            </div>
            <a
              href={`/login?returnUrl=${encodeURIComponent(`/platikas/${platikaId}`)}`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              Iniciar sesión para participar
            </a>
          </div>
        }
        sidebar={sidebar}
      />
    );
  }

  if (tokenState.status === "loading") {
    return (
      <RoomLayout
        stage={
          <div
            className="flex items-center justify-center h-full rounded-2xl"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2
                size={28}
                className="animate-spin"
                style={{ color: "var(--color-primary)" }}
              />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Conectando al escenario…
              </p>
            </div>
          </div>
        }
        sidebar={sidebar}
      />
    );
  }

  if (tokenState.status === "error") {
    return (
      <RoomLayout
        stage={
          <div
            className="flex items-center justify-center h-full rounded-2xl"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <AlertCircle size={28} style={{ color: "var(--color-destructive)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {tokenState.message}
              </p>
            </div>
          </div>
        }
        sidebar={sidebar}
      />
    );
  }

  return (
    <LKRoom
      token={tokenState.token}
      serverUrl={tokenState.wsUrl ?? defaultLkUrl}
      connect
      audio
      video={isHost || isSpeaker}
      className="contents"
    >
      <RoomLayout stage={<StagePanel />} sidebar={sidebar} />
    </LKRoom>
  );
}

function RoomLayout({
  stage,
  sidebar,
}: {
  stage: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: "600px" }}>
      <div className="flex-1 min-h-64 lg:min-h-0">{stage}</div>
      <div className="w-full lg:w-80 shrink-0 flex flex-col" style={{ maxHeight: "80vh" }}>
        {sidebar}
      </div>
    </div>
  );
}
```

Two intentional differences from the original file besides the restructure: (1) `radioOutputActive` prop removed from `LiveKitRoomProps` and no longer threaded to `HostControls` (dead after Task 6); (2) the `// TEMP DEBUG — remover después de diagnosticar` `console.log`/`console.error` calls (in the token-fetch `useEffect` and the `onConnected`/`onError`/`onDisconnected` handlers) are removed — they were already self-marked for removal and this task touches those exact lines anyway. The `onConnected`/`onError`/`onDisconnected` props are dropped entirely from `<LKRoom>` since their only content was those debug logs; add them back with real handling later if a genuine need comes up.

- [ ] **Step 2: Update the caller to drop the removed prop**

**Files:**
- Modify: `src/app/(public)/platikas/[id]/page.tsx`

Change:
```tsx
            <LiveKitRoom
              platikaId={id}
              roomName={p.livekit_room_name}
              isHost={isHost}
              isSpeaker={isSpeaker}
              currentUserId={currentUserId}
              radioOutputActive={p.radio_output_active}
            />
```
to:
```tsx
            <LiveKitRoom
              platikaId={id}
              roomName={p.livekit_room_name}
              isHost={isHost}
              isSpeaker={isSpeaker}
              currentUserId={currentUserId}
            />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/platikas/LiveKitRoom.tsx "src/app/(public)/platikas/[id]/page.tsx"
git commit -m "Move LKRoom to wrap the sidebar so RadioBroadcastPanel can use LiveKit hooks"
```

---

### Task 8: Full typecheck + manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 2: Confirm the dev server is running, then verify in-browser via claude-in-chrome**

Navigate to a live plática as the host (`/platikas/[id]` while its `status='live'` and the logged-in user is `host_id`) and confirm:
- The sidebar (chat, host controls) still renders correctly — the `LKRoom` restructure didn't break layout (watch specifically for the `className="contents"` actually neutralizing the wrapper div; if the sidebar/stage layout looks broken, inspect the DOM for an extra wrapping `<div>` from `LKRoom` that isn't behaving as `display: contents`).
- `RadioBroadcastPanel` shows the idle "Salida a radio" button.
- Clicking it goes to "Conectando…" then either the 3-toggle live panel, or a clear error (expected in this dev environment: Task 1's VPS infra likely isn't live-testable from here, and `.env.local` has placeholder `ELIM_RADIO_BRIDGE_*` values, so the realistic outcome is a clean error state, not a silent failure — that's the thing to verify: does it fail *visibly and clearly*, not silently).
- Toggling "Sala completa"/"Mi micrófono" doesn't throw a console error even with no bridge connected (state should still update locally).
- As a non-host viewer of the same plática, confirm `RadioBroadcastPanel`/`HostControls` don't render at all (existing `isHost &&` gate, untouched by this plan — just confirming the restructure didn't accidentally leak it).

- [ ] **Step 3: Fix any issues found**

If layout breaks or hooks don't work as expected inside the new `LKRoom` boundary, fix in place, re-run typecheck, and commit the fix with a message describing what was wrong.

---

### Task 9: Set production env vars and do a final live check

**Files:** none (production configuration + live verification — requires the user's explicit go-ahead, same as Task 1)

- [ ] **Step 1: Set the two new env vars in Vercel**

Using the `wsUrl` (`wss://radio.elimlldm.net/live-elim/`) and the `BRIDGE_KEY` generated in Task 1, set in the Vercel project's Production environment:
```
ELIM_RADIO_BRIDGE_WS_URL=wss://radio.elimlldm.net/live-elim/
ELIM_RADIO_BRIDGE_KEY=<value from Task 1, Step 6>
```
(Via the Vercel dashboard — per this project's existing memory, the Vercel MCP integration doesn't have access to this specific project, so this can't be automated from here; ask the user to set these two, or do it together via screen-share/guidance.)

- [ ] **Step 2: Redeploy and do a real end-to-end test**

After the next deploy (push to `master` triggers it, or a manual redeploy if env vars alone don't trigger one), have the actual site owner: start a plática, go live, open `RadioBroadcastPanel`, click "Salida a radio", confirm the panel reaches the "live" state (not an error), and confirm on `radio.elimlldm.net` (or the AzuraCast admin "Now Playing" panel) that the live source has actually taken over from AutoDJ.

- [ ] **Step 3: Report back**

Confirm the feature works end-to-end before considering this plan done. If the live check fails, the most likely culprits, in order: (a) nginx conf typo/reload didn't take (Task 1 Step 4-5), (b) `BRIDGE_KEY` mismatch between the VPS docker-compose env and the Vercel env var, (c) the AzuraCast streamer account/password mismatch (Task 1 Step 1-2), (d) `ICECAST_URL` port/mount wrong for station 2 (double check against the `dj_port`/`dj_mount_point` queried in Task 1 — 8015 and `/` respectively, as found during design-phase investigation, but re-verify since AzuraCast config can change).

---

## Self-Review Notes

- **Spec coverage:** three independent toggles with mic-only default (Task 5 `micOn`/`roomOn`/`pcOn`/`startBroadcast`), host/admin+live-only visibility (Task 2 route logic + existing `isHost &&` gate untouched), old button fully replaced not left in parallel (Task 3 deletes the route, Task 6 removes the button), `radio_output_active` reused as-is (Task 5 sets it, no page/badge code touched), VPS infra documented as its own gated task (Task 1), error handling table from the spec (radio-key failure → panel doesn't show; WS drop → error+retry; getDisplayMedia cancel → only that toggle reverts) — all implemented in Task 5. Out-of-scope items (volume sliders, tab-close resilience, YouTube/FB/TikTok streaming) — none touched.
- **Placeholder scan:** no TBD/TODO in code tasks. Task 1 has bracketed values like `<NEWPASS_FROM_STEP_1>` and `<GENERATE_A_NEW_RANDOM_KEY_HERE>` — these are intentional (real secrets that must be generated fresh at execution time, never hardcoded in a plan document), not spec gaps.
- **Type consistency:** `AudioMixer`'s `connect(key, stream)`/`disconnect(key)`/`has(key)` (Task 4) are called with matching signatures in `RadioBroadcastPanel` (Task 5) for all three source kinds (`livekit-${sid}` keys for mic/room, `"pc-audio"` for tab audio). `connectRadioBridge`/`startStreamingToBridge` signatures match their call sites exactly.
- **Scope:** one coherent feature across three fronts (VPS, backend, frontend) that only makes sense delivered together — not decomposed further, but Task 1/9 are clearly marked as controller-only, non-delegatable infrastructure work distinct from the code tasks.
