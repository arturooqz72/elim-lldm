"use client";

import { useState } from "react";
import { useRoomInfo } from "@livekit/components-react";
import { User, Columns2, Grid2x2, ScreenShare } from "lucide-react";
import { parseRoomMetadata } from "@/lib/livekit/room-metadata";
import type { StageLayout } from "@/types";

interface LayoutPickerProps {
  platikaId: string;
}

export const LAYOUTS: {
  value: StageLayout;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}[] = [
  { value: "solo", label: "Solo", icon: User },
  { value: "lado_a_lado", label: "Lado a lado", icon: Columns2 },
  { value: "grid", label: "Grid", icon: Grid2x2 },
  { value: "pantalla", label: "Pantalla", icon: ScreenShare },
];

export function parseStageLayout(metadata: string | undefined): StageLayout {
  const layout = parseRoomMetadata(metadata).layout;
  return LAYOUTS.some((l) => l.value === layout) ? (layout as StageLayout) : "grid";
}

// Selector de layout del anfitrión — vive en StagePanel (no en el
// sidebar) porque usa useRoomInfo(), que solo funciona dentro del
// <LiveKitRoom> ya conectado; StagePanel es el único lugar donde eso
// está garantizado (el sidebar se reutiliza también en las pantallas
// de "conectando"/"error", antes de que exista esa conexión). Se
// muestra en una fila debajo del canvas, no como overlay — mismo
// patrón que la fila de layouts de StreamYard.
export function LayoutPicker({ platikaId }: LayoutPickerProps) {
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
      className="flex items-center gap-1 p-1 rounded-full shrink-0"
      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
    >
      {LAYOUTS.map(({ value, label, icon: Icon }) => {
        const active = currentLayout === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => selectLayout(value)}
            disabled={pending}
            aria-label={label}
            title={label}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: active ? "var(--color-primary)" : "transparent" }}
          >
            <Icon size={15} style={{ color: active ? "#000" : "var(--color-text-muted)" }} />
          </button>
        );
      })}
    </div>
  );
}
