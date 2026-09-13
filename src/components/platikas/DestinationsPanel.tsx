"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { DestinoCard } from "./DestinoCard";
import { DestinoFormModal } from "./DestinoFormModal";
import type { DestinoConEstado } from "@/types";

interface DestinationsPanelProps {
  platikaId: string;
}

export function DestinationsPanel({ platikaId }: DestinationsPanelProps) {
  const [destinos, setDestinos] = useState<DestinoConEstado[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [modalDestino, setModalDestino] = useState<DestinoConEstado | null | "new">(null);

  async function loadDestinos() {
    const res = await fetch(`/api/platikas/${platikaId}/destinos`);
    if (res.ok) {
      const data = await res.json();
      setDestinos(data.destinos);
    }
  }

  useEffect(() => {
    loadDestinos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platikaId]);

  async function toggleDestino(destino: DestinoConEstado) {
    setLoadingId(destino.id);
    try {
      const res = await fetch(`/api/platikas/${platikaId}/destinos/${destino.id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: destino.isActive ? "stop" : "start" }),
      });
      if (res.ok) await loadDestinos();
    } finally {
      setLoadingId(null);
    }
  }

  async function deleteDestino(destino: DestinoConEstado) {
    if (!confirm(`¿Borrar el destino "${destino.nombre}"?`)) return;
    await fetch(`/api/destinos/${destino.id}`, { method: "DELETE" });
    await loadDestinos();
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        Transmisión a plataformas
      </p>

      <div className="flex flex-wrap gap-3 items-start">
        {destinos.map((destino) => (
          <DestinoCard
            key={destino.id}
            destino={destino}
            loading={loadingId === destino.id}
            onToggle={() => toggleDestino(destino)}
            onEdit={() => setModalDestino(destino)}
            onDelete={() => deleteDestino(destino)}
          />
        ))}

        <div className="flex flex-col items-center gap-1.5 w-16">
          <button
            type="button"
            onClick={() => setModalDestino("new")}
            aria-label="Agregar destino"
            className="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
            style={{ border: "2px dashed var(--color-border)" }}
          >
            <Plus size={20} style={{ color: "var(--color-text-muted)" }} />
          </button>
          <p className="text-[10px] text-center leading-tight" style={{ color: "var(--color-text-muted)" }}>
            Agregar
          </p>
        </div>
      </div>

      {modalDestino && (
        <DestinoFormModal
          destino={modalDestino === "new" ? null : modalDestino}
          onClose={() => setModalDestino(null)}
          onSaved={() => {
            setModalDestino(null);
            loadDestinos();
          }}
        />
      )}
    </div>
  );
}
