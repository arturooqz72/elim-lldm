"use client";

import { useState } from "react";
import { useRoomInfo } from "@livekit/components-react";
import { Check } from "lucide-react";
import { LAYOUTS, parseStageLayout } from "./LayoutPicker";
import type { StageLayout } from "@/types";

interface ScenesPanelProps {
  platikaId: string;
}

// Mini-diagrama de bloques por layout en vez de un ícono genérico —
// para que cada miniatura se lea como una vista previa real de cómo
// queda el escenario, no solo un glifo abstracto (mismo espíritu que
// las miniaturas de Scenes de StreamYard).
function SceneThumbnail({ layout, color }: { layout: StageLayout; color: string }) {
  const block = <div className="w-full h-full rounded-[3px]" style={{ background: color }} />;

  if (layout === "solo") {
    return <div className="w-3/5 h-3/5">{block}</div>;
  }
  if (layout === "lado_a_lado") {
    return (
      <div className="w-4/5 h-3/5 grid grid-cols-2 gap-1">
        {block}
        {block}
      </div>
    );
  }
  if (layout === "pantalla") {
    return (
      <div className="relative w-4/5 h-3/5">
        {block}
        <div className="absolute bottom-0 right-0 w-1/3 h-1/2 translate-x-1/4 translate-y-1/4">{block}</div>
      </div>
    );
  }
  // grid
  return (
    <div className="w-4/5 h-3/5 grid grid-cols-2 grid-rows-2 gap-1">
      {block}
      {block}
      {block}
      {block}
    </div>
  );
}

// Columna de "Escenas" a la izquierda del escenario — mismo lugar
// visual que el panel de Scenes de StreamYard. Cada "escena" acá es en
// realidad uno de los layouts existentes (no tenemos fondos/overlays
// guardables todavía), pero cumple el mismo rol visual: una columna
// con miniaturas que el anfitrión selecciona con un clic. Solo en
// pantallas grandes — en móvil se usa el selector compacto de
// LayoutPicker debajo del canvas (ver StagePanel), porque esta columna
// no cabe en 375px. Vive en StagePanel (no en el sidebar) porque
// useRoomInfo() solo funciona dentro del <LiveKitRoom> ya conectado.
export function ScenesPanel({ platikaId }: ScenesPanelProps) {
  const { metadata } = useRoomInfo();
  const currentLayout = parseStageLayout(metadata);
  const [pending, setPending] = useState(false);

  async function selectLayout(layout: StageLayout) {
    if (layout === currentLayout || pending) return;
    setPending(true);
    try {
      await fetch(`/api/platikas/${platikaId}/layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="hidden lg:flex flex-col w-44 shrink-0 rounded-2xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wider px-3 py-3"
        style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}
      >
        Escenas
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
        {LAYOUTS.map(({ value, label }) => {
          const active = currentLayout === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => selectLayout(value)}
              disabled={pending}
              className="flex flex-col gap-1.5 p-1.5 rounded-xl text-left transition-colors"
              style={{
                background: active ? "rgba(212,160,23,0.1)" : "transparent",
                border: active ? "1px solid var(--color-primary)" : "1px solid transparent",
              }}
            >
              <div
                className="relative w-full aspect-video rounded-lg flex items-center justify-center"
                style={{ background: "#000" }}
              >
                <SceneThumbnail layout={value} color={active ? "var(--color-primary)" : "var(--color-text-muted)"} />
                {active && (
                  <div
                    className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: "var(--color-primary)" }}
                  >
                    <Check size={10} style={{ color: "#000" }} />
                  </div>
                )}
              </div>
              <span
                className="text-xs font-medium px-0.5"
                style={{ color: active ? "var(--color-primary)" : "var(--color-text)" }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
