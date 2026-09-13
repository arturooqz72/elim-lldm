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

// Chip circular estilo StreamYard: un click prende/apaga el destino: al
// pasar el mouse (y solo si no está transmitiendo) aparecen editar/borrar
// encima, en vez de los botones de texto que tenía la versión anterior.
export function DestinoCard({ destino, loading, onToggle, onEdit, onDelete }: DestinoCardProps) {
  const estilo = DESTINO_ESTILOS[destino.plataforma];
  const Icon = estilo.icon;

  return (
    <div className="relative flex flex-col items-center gap-1.5 w-16 group">
      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        aria-label={destino.isActive ? `Detener ${destino.nombre}` : `Iniciar ${destino.nombre}`}
        className="relative w-14 h-14 rounded-full flex items-center justify-center transition-all"
        style={{
          background: `${estilo.accentColor}1A`,
          border: destino.isActive ? "2px solid var(--color-success)" : "2px solid var(--color-border)",
          boxShadow: destino.isActive ? "0 0 12px rgba(74,222,128,0.35)" : "none",
        }}
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin" style={{ color: estilo.accentColor }} />
        ) : (
          <Icon size={22} style={{ color: estilo.accentColor }} />
        )}

        {destino.isActive && (
          <span
            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full animate-pulse"
            style={{ background: "var(--color-success)", border: "2px solid var(--color-surface)" }}
          />
        )}
      </button>

      {!destino.isActive && (
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center gap-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
          style={{ background: "rgba(10,10,18,0.8)" }}
        >
          <button type="button" onClick={onEdit} aria-label="Editar destino" className="p-1">
            <Pencil size={13} style={{ color: "#fff" }} />
          </button>
          <button type="button" onClick={onDelete} aria-label="Borrar destino" className="p-1">
            <Trash2 size={13} style={{ color: "var(--color-destructive)" }} />
          </button>
        </div>
      )}

      <p
        className="text-[10px] text-center leading-tight truncate w-full"
        style={{ color: "var(--color-text-muted)" }}
        title={destino.nombre}
      >
        {destino.nombre}
      </p>
    </div>
  );
}
