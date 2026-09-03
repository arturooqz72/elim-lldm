"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OctagonX } from "lucide-react";

export function ArenaAbiertaEndButton({ salaId }: { salaId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    setLoading(true);
    try {
      await fetch(`/api/admin/arena-abierta/${salaId}/end`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "var(--color-destructive)", color: "#1a0000" }}
        >
          {loading ? "Terminando…" : "¿Seguro? Sí, terminar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
      style={{ background: "rgba(248,113,113,0.12)", color: "var(--color-destructive)" }}
    >
      <OctagonX size={13} />
      Terminar partida
    </button>
  );
}
