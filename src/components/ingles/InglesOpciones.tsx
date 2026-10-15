"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ETIQUETA_MODO, ETIQUETA_NIVEL, ETIQUETA_SITUACION, MODOS, NIVELES, SITUACIONES } from "@/lib/ingles/etiquetas";
import type { InglesPerfil } from "@/types";

const GOLD = "#f5c842";

function Pastilla({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 whitespace-nowrap"
      style={{
        background: activa ? GOLD : "var(--color-surface-elevated)",
        color: activa ? "#000" : "var(--color-text-muted)",
        border: `1px solid ${activa ? GOLD : "var(--color-border)"}`,
      }}
    >
      {children}
    </button>
  );
}

function Fila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider shrink-0 w-16" style={{ color: "var(--color-text-muted)" }}>
        {titulo}
      </span>
      <div className="flex gap-2 overflow-x-auto pb-0.5">{children}</div>
    </div>
  );
}

interface Props {
  perfil: InglesPerfil;
  onCambiar: (perfil: InglesPerfil) => void;
}

/**
 * Nivel, modo y lugar. En celular se juntan en un solo botón
 * ("Principiante · Conversación libre ▾") para dejarle espacio al chat; al
 * tocarlo se abren las filas. Desde 640px se ven siempre.
 */
export function InglesOpciones({ perfil, onCambiar }: Props) {
  const [abiertas, setAbiertas] = useState(false);
  const resumen = [
    ETIQUETA_NIVEL[perfil.nivel],
    ETIQUETA_MODO[perfil.modo],
    perfil.modo === "situaciones" ? ETIQUETA_SITUACION[perfil.situacion] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-2 px-3 min-[400px]:px-5 py-2 sm:py-3 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
      <button
        type="button"
        onClick={() => setAbiertas((a) => !a)}
        className="sm:hidden flex items-center justify-between gap-2 text-xs text-left"
        aria-expanded={abiertas}
        style={{ color: "var(--color-text)" }}
      >
        <span className="min-w-0 truncate">
          <span style={{ color: "var(--color-text-muted)" }}>Nivel y modo: </span>
          <strong>{resumen}</strong>
        </span>
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform"
          style={{ color: "var(--color-text-muted)", transform: abiertas ? "rotate(180deg)" : undefined }}
        />
      </button>
      <div className={`${abiertas ? "flex" : "hidden"} sm:flex flex-col gap-2`}>
        <Fila titulo="Nivel">
          {NIVELES.map((n) => (
            <Pastilla key={n} activa={perfil.nivel === n} onClick={() => onCambiar({ ...perfil, nivel: n })}>
              {ETIQUETA_NIVEL[n]}
            </Pastilla>
          ))}
        </Fila>
        <Fila titulo="Modo">
          {MODOS.map((m) => (
            <Pastilla key={m} activa={perfil.modo === m} onClick={() => onCambiar({ ...perfil, modo: m })}>
              {ETIQUETA_MODO[m]}
            </Pastilla>
          ))}
        </Fila>
        {perfil.modo === "situaciones" && (
          <Fila titulo="Lugar">
            {SITUACIONES.map((s) => (
              <Pastilla key={s} activa={perfil.situacion === s} onClick={() => onCambiar({ ...perfil, situacion: s })}>
                {ETIQUETA_SITUACION[s]}
              </Pastilla>
            ))}
          </Fila>
        )}
      </div>
    </div>
  );
}
