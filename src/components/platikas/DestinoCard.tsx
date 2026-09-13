"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { DESTINO_ESTILOS } from "@/lib/platikas/destino-estilos";
import type { DestinoConEstado } from "@/types";

interface DestinoCardProps {
  destino: DestinoConEstado;
  loading: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function DestinoCard({ destino, loading, onToggle, onEdit, onDelete }: DestinoCardProps) {
  const estilo = DESTINO_ESTILOS[destino.plataforma];
  const Icon = estilo.icon;

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2.5"
      style={{
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${estilo.accentColor}1A` }}
        >
          <Icon size={14} style={{ color: estilo.accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
            {destino.nombre}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {estilo.label}
          </p>
        </div>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${destino.isActive ? "animate-pulse" : ""}`}
          style={{ background: destino.isActive ? "var(--color-success)" : "var(--color-border)" }}
          title={destino.isActive ? "Transmitiendo" : "Inactivo"}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
          style={
            destino.isActive
              ? {
                  background: "rgba(248,113,113,0.15)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  color: "var(--color-destructive)",
                }
              : { background: "var(--color-primary)", color: "#000" }
          }
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {destino.isActive ? "Detener" : "Iniciar transmisión"}
        </button>
        <button
          onClick={onEdit}
          disabled={destino.isActive}
          className="p-2 rounded-lg disabled:opacity-30"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          title="Editar destino"
        >
          <Pencil size={13} style={{ color: "var(--color-text-muted)" }} />
        </button>
        <button
          onClick={onDelete}
          disabled={destino.isActive}
          className="p-2 rounded-lg disabled:opacity-30"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          title="Borrar destino"
        >
          <Trash2 size={13} style={{ color: "var(--color-destructive)" }} />
        </button>
      </div>
    </div>
  );
}
