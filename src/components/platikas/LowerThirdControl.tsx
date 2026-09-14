"use client";

import { useEffect, useState } from "react";
import { useRoomInfo } from "@livekit/components-react";
import { Type } from "lucide-react";
import { parseRoomMetadata, type LowerThirdState } from "@/lib/livekit/room-metadata";

interface LowerThirdControlProps {
  platikaId: string;
}

export function parseLowerThird(metadata: string | undefined): LowerThirdState {
  const lowerThird = parseRoomMetadata(metadata).lowerThird;
  return {
    visible: !!lowerThird?.visible,
    title: lowerThird?.title ?? "",
    subtitle: lowerThird?.subtitle ?? "",
  };
}

// Control del banner de nombre — igual que LayoutPicker, vive sobre el
// escenario (no en el sidebar) porque useRoomInfo() solo funciona
// dentro del <LiveKitRoom> ya conectado.
export function LowerThirdControl({ platikaId }: LowerThirdControlProps) {
  const { metadata } = useRoomInfo();
  const current = parseLowerThird(metadata);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(current.title);
  const [subtitle, setSubtitle] = useState(current.subtitle);
  const [saving, setSaving] = useState(false);

  // Si el banner cambió desde otro lado (otro admin, otra pestaña),
  // refleja esos textos al abrir el panel — pero no mientras el
  // anfitrión está escribiendo, para no pisarle lo que teclea.
  useEffect(() => {
    if (!open) {
      setTitle(current.title);
      setSubtitle(current.subtitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.title, current.subtitle, open]);

  async function publish(visible: boolean) {
    setSaving(true);
    try {
      await fetch(`/api/platikas/${platikaId}/lower-third`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible, title, subtitle }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute top-14 left-3 z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Banner de nombre"
        title="Banner de nombre"
        className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
        style={{
          background: current.visible ? "var(--color-primary)" : "rgba(10,10,18,0.75)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Type size={15} style={{ color: current.visible ? "#000" : "#fff" }} />
      </button>

      {open && (
        <div
          className="absolute top-11 left-0 w-64 p-3 rounded-xl flex flex-col gap-2.5 backdrop-blur-md z-10"
          style={{ background: "rgba(10,10,18,0.92)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 60))}
              placeholder='Ej: "Fernando Pérez"'
              className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
              Subtítulo (opcional)
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value.slice(0, 80))}
              placeholder='Ej: "Conductor"'
              className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
            />
          </div>
          <button
            type="button"
            onClick={() => publish(!current.visible)}
            disabled={saving || (!current.visible && !title.trim())}
            className="w-full py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
            style={
              current.visible
                ? {
                    background: "rgba(248,113,113,0.15)",
                    border: "1px solid rgba(248,113,113,0.3)",
                    color: "var(--color-destructive)",
                  }
                : { background: "var(--color-primary)", color: "#000" }
            }
          >
            {current.visible ? "Ocultar banner" : "Mostrar banner"}
          </button>
        </div>
      )}
    </div>
  );
}
