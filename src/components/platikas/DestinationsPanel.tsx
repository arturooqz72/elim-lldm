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
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Transmisión a plataformas
        </p>
        <button
          onClick={() => setModalDestino("new")}
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: "var(--color-primary)" }}
        >
          <Plus size={14} />
          Agregar destino
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {destinos.length === 0 && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            No hay destinos guardados todavía.
          </p>
        )}
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
