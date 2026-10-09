"use client";

import { useState } from "react";
import { Check, Pencil, Power, X } from "lucide-react";
import { cambiarActiva, revisarPendiente } from "./acciones";
import { PreguntaFormBanco, type PreguntaEditable } from "./PreguntaFormBanco";
import { CATEGORIA_LABEL, NIVEL_LABEL, esCategoria, esNivel } from "@/lib/trivia/banco";

export interface FilaPregunta extends PreguntaEditable {
  activa: boolean;
  estado: "aprobada" | "pendiente" | "rechazada";
  origen: "manual" | "banco_inicial" | "generada";
  veces_respondida: number;
  veces_acertada: number;
}

const LETRAS = ["a", "b", "c", "d"] as const;

function Etiqueta({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: "var(--color-surface-elevated)", color }}
    >
      {children}
    </span>
  );
}

function BotonAccion({
  accion,
  campos,
  filtros,
  children,
  color,
}: {
  accion: (formData: FormData) => Promise<void>;
  campos: Record<string, string>;
  filtros: string;
  children: React.ReactNode;
  color: string;
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="filtros" value={filtros} />
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
        style={{ background: "var(--color-surface-elevated)", color }}
      >
        {children}
      </button>
    </form>
  );
}

export function PreguntaFila({ pregunta, filtros }: { pregunta: FilaPregunta; filtros: string }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return <PreguntaFormBanco pregunta={pregunta} filtros={filtros} onCancelar={() => setEditando(false)} />;
  }

  const acierto =
    pregunta.veces_respondida > 0 ? Math.round((pregunta.veces_acertada / pregunta.veces_respondida) * 100) : null;

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-2xl"
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${pregunta.estado === "pendiente" ? "var(--color-primary)" : "var(--color-border)"}`,
        opacity: pregunta.activa && pregunta.estado !== "rechazada" ? 1 : 0.6,
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {esNivel(pregunta.dificultad) && <Etiqueta color="var(--color-primary)">{NIVEL_LABEL[pregunta.dificultad]}</Etiqueta>}
        {esCategoria(pregunta.categoria) && (
          <Etiqueta color="var(--color-info)">{CATEGORIA_LABEL[pregunta.categoria]}</Etiqueta>
        )}
        {pregunta.estado === "pendiente" && <Etiqueta color="var(--color-primary)">Pendiente de revisión</Etiqueta>}
        {pregunta.estado === "rechazada" && <Etiqueta color="var(--color-destructive)">Rechazada</Etiqueta>}
        {!pregunta.activa && <Etiqueta color="var(--color-destructive)">Desactivada</Etiqueta>}
        {pregunta.origen === "generada" && <Etiqueta color="var(--color-text-muted)">Generada</Etiqueta>}
      </div>

      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        {pregunta.question_text}
      </p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {LETRAS.map((letra) => {
          const correcta = pregunta.correct_option === letra;
          return (
            <li
              key={letra}
              className="flex items-start gap-2 px-3 py-1.5 rounded-lg text-sm"
              style={{
                background: correcta ? "rgba(74,222,128,0.1)" : "var(--color-surface-elevated)",
                color: correcta ? "var(--color-success)" : "var(--color-text-muted)",
              }}
            >
              <span className="font-bold uppercase">{letra}</span>
              <span className="min-w-0 break-words">{pregunta[`option_${letra}`]}</span>
              {correcta && <Check size={14} className="ml-auto shrink-0 mt-0.5" aria-label="Correcta" />}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {pregunta.bible_reference ?? "Sin cita"} · Respondida {pregunta.veces_respondida}{" "}
          {pregunta.veces_respondida === 1 ? "vez" : "veces"}
          {acierto !== null && ` · ${acierto}% de acierto`}
        </p>

        <div className="flex flex-wrap gap-2">
          {pregunta.estado === "pendiente" && (
            <>
              <BotonAccion
                accion={revisarPendiente}
                campos={{ id: pregunta.id, decision: "aprobar" }}
                filtros={filtros}
                color="var(--color-success)"
              >
                <Check size={13} /> Aprobar
              </BotonAccion>
              <BotonAccion
                accion={revisarPendiente}
                campos={{ id: pregunta.id, decision: "rechazar" }}
                filtros={filtros}
                color="var(--color-destructive)"
              >
                <X size={13} /> Rechazar
              </BotonAccion>
            </>
          )}
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
          >
            <Pencil size={13} /> Editar
          </button>
          {pregunta.estado !== "rechazada" && (
            <BotonAccion
              accion={cambiarActiva}
              campos={{ id: pregunta.id, activa: String(!pregunta.activa) }}
              filtros={filtros}
              color={pregunta.activa ? "var(--color-destructive)" : "var(--color-success)"}
            >
              <Power size={13} /> {pregunta.activa ? "Desactivar" : "Activar"}
            </BotonAccion>
          )}
        </div>
      </div>
    </div>
  );
}
