"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StopCircle, Mic, Loader2 } from "lucide-react";

interface StudioGoLiveButtonProps {
  platikaId: string;
  isLive: boolean;
  onLiveChange: (isLive: boolean) => void;
}

// Vive en la barra superior del estudio (ver StudioShell), no en el
// sidebar — mismo lugar que el botón "Go live" de StreamYard.
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
      <button
        type="button"
        onClick={goLive}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all shrink-0"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
        Salir al aire
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={endPlatica}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all shrink-0"
      style={{
        background: "rgba(248,113,113,0.15)",
        border: "1px solid rgba(248,113,113,0.3)",
        color: "var(--color-destructive)",
      }}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <StopCircle size={15} />}
      Terminar
    </button>
  );
}
