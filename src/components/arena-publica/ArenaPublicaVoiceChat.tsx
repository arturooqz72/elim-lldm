"use client";

import { useState } from "react";
import {
  LiveKitRoom as LKRoom,
  useLocalParticipant,
  useParticipants,
  useTracks,
  AudioTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Mic, MicOff, PhoneOff, Loader2 } from "lucide-react";
import { AudioLevelMeter } from "@/components/platikas/AudioLevelMeter";

interface ArenaPublicaVoiceChatProps {
  salaId: string;
  jugadorId: string;
}

type State =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; token: string; wsUrl: string }
  | { status: "error"; message: string };

export function ArenaPublicaVoiceChat({ salaId, jugadorId }: ArenaPublicaVoiceChatProps) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleJoinVoice() {
    setState({ status: "connecting" });
    try {
      const res = await fetch("/api/arena-publica/voice-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sala_id: salaId, jugador_id: jugadorId }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setState({ status: "error", message: data.error ?? "No se pudo conectar el micrófono" });
        return;
      }
      setState({ status: "connected", token: data.token, wsUrl: data.wsUrl ?? "" });
    } catch {
      setState({ status: "error", message: "No se pudo conectar el micrófono" });
    }
  }

  function handleLeaveVoice() {
    setState({ status: "idle" });
  }

  if (state.status === "connected") {
    return (
      <LKRoom
        token={state.token}
        serverUrl={state.wsUrl}
        connect
        audio
        video={false}
        className="contents"
        onDisconnected={handleLeaveVoice}
      >
        <VoiceChatBar onLeave={handleLeaveVoice} />
      </LKRoom>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
    >
      <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
        {state.status === "error" ? state.message : "Chat de voz apagado"}
      </span>
      <button
        type="button"
        onClick={handleJoinVoice}
        disabled={state.status === "connecting"}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        {state.status === "connecting" ? <Loader2 size={13} className="animate-spin" /> : <Mic size={13} />}
        {state.status === "connecting" ? "Conectando…" : "Encender micrófono"}
      </button>
    </div>
  );
}

function VoiceChatBar({ onLeave }: { onLeave: () => void }) {
  const { localParticipant, isMicrophoneEnabled, microphoneTrack } = useLocalParticipant();
  const participants = useParticipants();
  const micTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }]);
  const audibleTracks = micTracks.filter((t) => !t.publication?.isMuted && !t.participant.isLocal);

  async function toggleMic() {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl flex-wrap"
      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
    >
      {audibleTracks.map((trackRef) =>
        trackRef.publication ? (
          <AudioTrack key={trackRef.participant.sid} trackRef={trackRef} className="hidden" />
        ) : null
      )}

      <button
        type="button"
        onClick={toggleMic}
        aria-label={isMicrophoneEnabled ? "Apagar micrófono" : "Encender micrófono"}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: isMicrophoneEnabled ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
          color: isMicrophoneEnabled ? "var(--color-success)" : "var(--color-destructive)",
        }}
      >
        {isMicrophoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}
      </button>

      {isMicrophoneEnabled && (
        <AudioLevelMeter track={microphoneTrack?.track?.mediaStreamTrack} height={12} />
      )}

      <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
        {participants.map((p) => (
          <span
            key={p.identity}
            className="text-xs px-2 py-1 rounded-full truncate max-w-[100px]"
            style={{
              background: p.isSpeaking ? "rgba(74,222,128,0.15)" : "var(--color-surface)",
              color: p.isSpeaking ? "var(--color-success)" : "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            {p.name || "Jugador"}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onLeave}
        aria-label="Salir del chat de voz"
        title="Salir del chat de voz"
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "rgba(248,113,113,0.15)", color: "var(--color-destructive)" }}
      >
        <PhoneOff size={14} />
      </button>
    </div>
  );
}
