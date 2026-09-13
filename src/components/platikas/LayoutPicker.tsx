"use client";

import { useState } from "react";
import { useRoomInfo } from "@livekit/components-react";
import { User, Columns2, Grid2x2, ScreenShare } from "lucide-react";
import type { StageLayout } from "@/types";

interface LayoutPickerProps {
  platikaId: string;
}

const LAYOUTS: {
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
  if (!metadata) return "grid";
  try {
    const parsed = JSON.parse(metadata) as { layout?: string };
    if (LAYOUTS.some((l) => l.value === parsed.layout)) {
      return parsed.layout as StageLayout;
    }
  } catch {
    // metadata sin layout válido — se usa el default
  }
  return "grid";
}

// Selector de layout del anfitrión — vive sobre el escenario (no en el
// sidebar) porque usa useRoomInfo(), que solo funciona dentro del
// <LiveKitRoom> ya conectado; StagePanel es el único lugar donde eso
// está garantizado (el sidebar se reutiliza también en las pantallas
// de "conectando"/"error", antes de que exista esa conexión).
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
      className="absolute top-3 left-3 z-10 flex items-center gap-1 p-1 rounded-full backdrop-blur-md"
      style={{ background: "rgba(10,10,18,0.75)", border: "1px solid rgba(255,255,255,0.1)" }}
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
            <Icon size={15} style={{ color: active ? "#000" : "#fff" }} />
          </button>
        );
      })}
    </div>
  );
}
