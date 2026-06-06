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
  radioOutputActive: boolean;
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
  radioOutputActive,
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
          radioOutputActive={radioOutputActive}
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
              href="/login"
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
    <RoomLayout
      stage={
        <LKRoom
          token={tokenState.token}
          serverUrl={tokenState.wsUrl ?? defaultLkUrl}
          connect
          audio
          video={isHost || isSpeaker}
          className="w-full h-full"
        >
          <StagePanel />
        </LKRoom>
      }
      sidebar={sidebar}
    />
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
