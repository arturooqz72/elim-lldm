"use client";

import { RequestQueue } from "./RequestQueue";
import { DestinationsPanel } from "./DestinationsPanel";
import { RadioBroadcastPanel } from "./RadioBroadcastPanel";
import { SpeakerControls } from "./SpeakerControls";
import type { ProgramaAudio } from "@/types";

interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  onSpeakerApproved?: (token: string, wsUrl: string) => void;
  programaAudios?: ProgramaAudio[];
}

// El botón "Salir al aire"/"Terminar" vive en la barra superior del
// estudio (ver StudioGoLiveButton) — antes estaba aquí, escondido
// dentro de esta sección del panel lateral.
export function HostControls({
  platikaId,
  isLive,
  onSpeakerApproved,
  programaAudios,
}: HostControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Estado del anfitrión */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Controles del anfitrión
        </p>

        <div className="flex flex-col gap-2">
          {!isLive ? (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Estás en backstage: prueba tu mic y cámara. Nadie más te ve ni te escucha
              todavía. Usa &quot;Salir al aire&quot; en la parte superior cuando estés listo.
            </p>
          ) : (
            <RadioBroadcastPanel platikaId={platikaId} programaAudios={programaAudios} />
          )}
        </div>
      </div>

      {/* Destinos de streaming — solo visible en vivo */}
      {isLive && <DestinationsPanel platikaId={platikaId} />}

      {/* Speakers on stage — mute/remove guests — only visible when live */}
      {isLive && <SpeakerControls platikaId={platikaId} />}

      {/* Request queue — only visible when live */}
      {isLive && (
        <RequestQueue
          platikaId={platikaId}
          onApprove={onSpeakerApproved}
        />
      )}
    </div>
  );
}
