"use client";

import { useEffect, useRef, useState } from "react";
import { useMaybeRoomContext, useTracks } from "@livekit/components-react";
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

// LiveKitRoom.tsx renders the sidebar (and this component inside it) both
// before a room connection exists (loading/error states) and after. useTracks
// throws if called outside a Room context, which would crash the whole page
// during those pre-connection states. useMaybeRoomContext never throws, so it
// gates whether the real panel (and its useTracks call) mounts at all.
export function RadioBroadcastPanel({ platikaId }: RadioBroadcastPanelProps) {
  const room = useMaybeRoomContext();
  if (!room) return null;
  return <ConnectedRadioBroadcastPanel platikaId={platikaId} />;
}

function ConnectedRadioBroadcastPanel({ platikaId }: RadioBroadcastPanelProps) {
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

      if (shouldBeOn) {
        mixer.connect(key, new MediaStream([mediaTrack]));
      } else if (mixer.has(key)) {
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
      wsRef.current?.close();
      cleanup();
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
    setErrorMsg("");

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
        <button
          type="button"
          onClick={stopBroadcast}
          aria-label="Detener transmisión"
          style={{ color: "var(--color-destructive)" }}
        >
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
