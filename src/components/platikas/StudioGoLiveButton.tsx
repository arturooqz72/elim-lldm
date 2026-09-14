"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StopCircle, Mic, Loader2 } from "lucide-react";

interface StudioGoLiveButtonProps {
  platikaId: string;
  isLive: boolean;
  onLiveChange: (isLive: boolean) => void;
}

// Vive en la barra superior del estudio (ver StudioShell) — antes
// estaba escondido dentro del panel lateral de "Controles del
// anfitrión", donde no se veía sin abrir esa sección primero.
export function StudioGoLiveButton({ platikaId, isLive, onLiveChange }: StudioGoLiveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function goLive() {
    setLoading(true);
    try {
      const res = await fetch(`/api/platikas/${platikaId}/go-live`, { method: "POST" });
      if (res.ok) {
        onLiveChange(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function endPlatica() {
    if (!confirm("¿Terminar la plática? No podrá reanudarse.")) return;
    setLoading(true);
    try {
      await fetch(`/api/platikas/${platikaId}/end`, { method: "POST" });
      onLiveChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!isLive) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={endPlatica}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-sm transition-all shrink-0"
          style={{
            background: "rgba(220,38,38,0.1)",
            border: "1px solid rgba(220,38,38,0.3)",
            color: "var(--color-destructive)",
          }}
        >
          <StopCircle size={15} />
          Terminar
        </button>
        <button
          type="button"
          onClick={goLive}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all shrink-0"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
          Salir al aire
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={endPlatica}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all shrink-0"
      style={{
        background: "rgba(220,38,38,0.1)",
        border: "1px solid rgba(220,38,38,0.3)",
        color: "var(--color-destructive)",
      }}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <StopCircle size={15} />}
      Terminar
    </button>
  );
}
