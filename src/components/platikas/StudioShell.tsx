"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Radio } from "lucide-react";
import { LiveKitRoom } from "./LiveKitRoom";
import { StudioGoLiveButton } from "./StudioGoLiveButton";
import type { ProgramaAudio } from "@/types";

interface StudioShellProps {
  platikaId: string;
  roomName: string;
  title: string;
  isHost: boolean;
  isSpeaker: boolean;
  currentUserId: string | null;
  canModerateChat: boolean;
  programaAudios?: ProgramaAudio[];
  initialIsLive: boolean;
  radioActive: boolean;
}

// Dueño del estado "en vivo" del estudio — la barra superior (con el
// botón "Salir al aire"/"Terminar") y LiveKitRoom son hermanos que
// necesitan ver el mismo valor, así que vive aquí en vez de dentro de
// LiveKitRoom.
export function StudioShell({
  platikaId,
  roomName,
  title,
  isHost,
  isSpeaker,
  currentUserId,
  canModerateChat,
  programaAudios,
  initialIsLive,
  radioActive,
}: StudioShellProps) {
  const [isLive, setIsLive] = useState(initialIsLive);

  return (
    <>
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <Link
          href="/platikas"
          className="flex items-center gap-2 shrink-0"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={16} />
          <span
            className="text-sm font-bold tracking-wide hidden sm:inline"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
          >
            Elim LLDM
          </span>
        </Link>

        <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
          {isLive ? (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold animate-pulse shrink-0"
              style={{ background: "var(--color-live)", color: "#fff" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
              EN VIVO
            </span>
          ) : (
            isHost && (
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                style={{
                  background: "rgba(212,160,23,0.1)",
                  border: "1px solid rgba(212,160,23,0.2)",
                  color: "var(--color-primary)",
                }}
              >
                <Clock size={11} />
                BACKSTAGE
              </span>
            )
          )}
          {isLive && radioActive && (
            <span
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
              style={{
                background: "rgba(96,165,250,0.1)",
                border: "1px solid rgba(96,165,250,0.2)",
                color: "#60A5FA",
              }}
            >
              <Radio size={11} />
              En radio
            </span>
          )}
          <span
            className="text-sm font-medium truncate"
            style={{ color: "var(--color-text)" }}
            title={title}
          >
            {title}
          </span>
        </div>

        {isHost && (
          <StudioGoLiveButton platikaId={platikaId} isLive={isLive} onLiveChange={setIsLive} />
        )}
      </div>

      <div className="flex-1 min-h-0 p-3">
        <LiveKitRoom
          platikaId={platikaId}
          roomName={roomName}
          isHost={isHost}
          isSpeaker={isSpeaker}
          currentUserId={currentUserId}
          canModerateChat={canModerateChat}
          programaAudios={programaAudios}
          isLive={isLive}
        />
      </div>
    </>
  );
}
