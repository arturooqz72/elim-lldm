// src/components/juegos/palabra/PuntosListas.tsx
"use client";

import { useState } from "react";
import { Flame, Lightbulb } from "lucide-react";
import type {
  PalabraPuntosHoyFila,
  PalabraPuntosPersona,
  PalabraPuntosRachaFila,
  PalabraPuntosSemanaFila,
} from "@/types";

// Mismos oro/plata/bronce que RankingLista.
const RANK_COLORS = ["#D4A017", "#C0C0C0", "#CD7F32"];

function Avatar({ nombre, avatar, grande }: { nombre: string; avatar: string | null; grande?: boolean }) {
  const tam = grande ? "w-11 h-11 text-base" : "w-7 h-7 text-xs";
  // Si la foto no carga (enlace vencido, bloqueo de la red), la inicial.
  const [fallo, setFallo] = useState(false);
  return avatar && !fallo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatar}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFallo(true)}
      className={`${tam} rounded-full object-cover shrink-0`}
    />
  ) : (
    <span
      className={`${tam} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
    >
      {nombre[0]?.toUpperCase()}
    </span>
  );
}

function Fila({ p, detalle, valor, subvalor }: { p: PalabraPuntosPersona; detalle: React.ReactNode; valor: React.ReactNode; subvalor: string }) {
  const color = RANK_COLORS[p.posicion - 1] ?? null;
  return (
    <li
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
      style={{
        background: p.esYo ? "rgba(212,160,23,0.12)" : "var(--color-surface-elevated)",
        border: `1px solid ${p.esYo ? "rgba(212,160,23,0.45)" : "transparent"}`,
      }}
    >
      <span
        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 tabular-nums"
        style={{ background: color ? `${color}22` : "transparent", color: color ?? "var(--color-text-muted)" }}
      >
        {p.posicion}
      </span>
      <Avatar nombre={p.nombre} avatar={p.avatar} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
          {p.nombre}
          {p.esYo && <span style={{ color: "var(--color-primary)" }}> (tú)</span>}
        </p>
        <p className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>
          {detalle}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>
          {valor}
        </p>
        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          {subvalor}
        </p>
      </div>
    </li>
  );
}

/** Tarjeta del primer lugar: "🏆 Ganador de hoy" / "Líder de la semana". */
function Destacado({ titulo, p, linea }: { titulo: string; p: PalabraPuntosPersona; linea: string }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-3 rounded-xl mb-2"
      style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.4)" }}
    >
      <Avatar nombre={p.nombre} avatar={p.avatar} grande />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>
          {titulo}
        </p>
        <p className="text-base font-bold truncate" style={{ color: "var(--color-text)" }}>
          {p.nombre}
          {p.esYo && <span style={{ color: "var(--color-primary)" }}> (tú)</span>}
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {linea}
        </p>
      </div>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="text-xs text-center px-4 py-6" style={{ color: "var(--color-text-muted)" }}>
      {texto}
    </p>
  );
}

/** "Tú: lugar 14 · 35 puntos" cuando quien mira no está en la lista visible. */
function TuLugar({ texto }: { texto: string }) {
  return (
    <p
      className="mt-2 px-3 py-2 rounded-lg text-xs font-semibold text-center"
      style={{ background: "rgba(212,160,23,0.08)", border: "1px dashed rgba(212,160,23,0.45)", color: "var(--color-text)" }}
    >
      {texto}
    </p>
  );
}

const pts = (n: number) => `${n} ${n === 1 ? "punto" : "puntos"}`;
const intentosTexto = (f: PalabraPuntosHoyFila) => `${f.intentos} de 6 intentos`;

export function ListaHoy({ filas, yo }: { filas: PalabraPuntosHoyFila[]; yo: PalabraPuntosHoyFila | null }) {
  if (filas.length === 0) return <Vacio texto="Nadie ha resuelto la palabra de hoy todavía. ¡Sé el primero!" />;
  const [primero] = filas;
  return (
    <>
      <Destacado
        titulo="🏆 Ganador de hoy"
        p={primero}
        linea={`${pts(primero.puntos)} · ${intentosTexto(primero)} · va ganando hasta ahora`}
      />
      <ol className="flex flex-col gap-1.5">
        {filas.map((f) => (
          <Fila
            key={f.posicion}
            p={f}
            detalle={
              <span className="inline-flex items-center gap-1">
                {intentosTexto(f)}
                {f.pista && (
                  <>
                    {" · "}
                    <Lightbulb size={11} /> con pista
                  </>
                )}
              </span>
            }
            valor={f.puntos}
            subvalor="puntos"
          />
        ))}
      </ol>
      {yo && <TuLugar texto={`Tú: lugar ${yo.posicion} · ${pts(yo.puntos)}`} />}
    </>
  );
}

export function ListaSemana({ filas, yo }: { filas: PalabraPuntosSemanaFila[]; yo: PalabraPuntosSemanaFila | null }) {
  if (filas.length === 0) return <Vacio texto="Nadie ha sumado puntos en los últimos 7 días." />;
  const [primero] = filas;
  return (
    <>
      <Destacado
        titulo="⭐ Líder de la semana"
        p={primero}
        linea={`${pts(primero.puntos)} · ${primero.dias} ${primero.dias === 1 ? "día" : "días"} jugados`}
      />
      <ol className="flex flex-col gap-1.5">
        {filas.map((f) => (
          <Fila
            key={f.posicion}
            p={f}
            detalle={
              <span className="inline-flex items-center gap-1">
                {f.dias} {f.dias === 1 ? "día" : "días"}
                {f.racha > 0 && (
                  <>
                    {" · "}
                    <Flame size={11} /> racha {f.racha}
                  </>
                )}
              </span>
            }
            valor={f.puntos}
            subvalor="puntos"
          />
        ))}
      </ol>
      {yo && <TuLugar texto={`Tú: lugar ${yo.posicion} · ${pts(yo.puntos)}`} />}
    </>
  );
}

export function ListaRachas({ filas }: { filas: PalabraPuntosRachaFila[] }) {
  if (filas.length === 0) return <Vacio texto="Todavía no hay rachas activas." />;
  return (
    <ol className="flex flex-col gap-1.5">
      {filas.map((f) => (
        <Fila
          key={f.posicion}
          p={f}
          detalle={`máxima: ${f.maxima} ${f.maxima === 1 ? "día" : "días"}`}
          valor={
            <span className="inline-flex items-center gap-1">
              <Flame size={12} /> {f.actual}
            </span>
          }
          subvalor={f.actual === 1 ? "día" : "días"}
        />
      ))}
    </ol>
  );
}
