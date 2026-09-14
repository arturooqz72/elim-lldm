"use client";

import { RadioBroadcastPanel } from "./RadioBroadcastPanel";
import type { ProgramaAudio } from "@/types";

interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  programaAudios?: ProgramaAudio[];
}

// El botón "Salir al aire"/"Terminar" vive en la barra superior del
// estudio (ver StudioGoLiveButton), no aquí — así queda visible sin
// necesidad de abrir esta pestaña del sidebar, igual que el botón
// "Go live" de StreamYard.
export function HostControls({ platikaId, isLive, programaAudios }: HostControlsProps) {
  return (
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

      {!isLive ? (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Estás en backstage: prueba tu mic y cámara. Nadie más te ve ni te escucha todavía. Usa
          &quot;Salir al aire&quot; en la parte superior cuando estés listo.
        </p>
      ) : (
        <RadioBroadcastPanel platikaId={platikaId} programaAudios={programaAudios} />
      )}
    </div>
  );
}
