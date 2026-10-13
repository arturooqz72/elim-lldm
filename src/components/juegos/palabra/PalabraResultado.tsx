// src/components/juegos/palabra/PalabraResultado.tsx
"use client";

import { useEffect, useState } from "react";
import { BookOpen, Copy, MessageCircle, Share2, Trophy } from "lucide-react";
import { PALABRA_MAX_INTENTOS } from "@/lib/palabra/config";
import { textoParaCompartir } from "@/lib/palabra/logica";
import type { PalabraEstadoJugador, PalabraPartidaEstado, PalabraRevelada } from "@/types";
import { CuentaRegresiva } from "./CuentaRegresiva";
import { PalabraEstadisticas } from "./PalabraEstadisticas";
import { InvitacionSesion } from "./InvitacionSesion";
import { PermisoTikTok } from "./PermisoTikTok";

const WHATSAPP_GREEN = "#25D366";

interface PalabraResultadoProps {
  fecha: string;
  partida: PalabraPartidaEstado;
  revelado: PalabraRevelada | null;
  estado: PalabraEstadoJugador;
  conSesion: boolean;
  tiktokPermiso: boolean;
  onAviso: (mensaje: string) => void;
  onPuntos: () => void;
}

export function PalabraResultado({
  fecha,
  partida,
  revelado,
  estado,
  conSesion,
  tiktokPermiso,
  onAviso,
  onPuntos,
}: PalabraResultadoProps) {
  // navigator.share solo existe en el cliente: se detecta después de
  // montar para que el HTML del servidor y la hidratación coincidan.
  const [puedeCompartir, setPuedeCompartir] = useState(false);
  useEffect(() => {
    setPuedeCompartir(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  // Si al resolver quedó en primer lugar del día, se le pide el permiso de
  // TikTok de forma destacada (el ganador sale en el video de mañana).
  const [vaGanando, setVaGanando] = useState(false);
  useEffect(() => {
    if (!conSesion || !partida.resuelta) return;
    let vivo = true;
    fetch("/api/juegos/palabra/puntos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { dia?: { filas?: Array<{ esYo: boolean }> } } | null) => {
        if (vivo) setVaGanando(d?.dia?.filas?.[0]?.esYo === true);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [conSesion, partida.resuelta]);

  const texto = textoParaCompartir({
    fecha,
    intentos: partida.intentos,
    resuelta: partida.resuelta,
    racha: estado.racha.actual,
    pistaUsada: partida.pistaUsada,
  });

  async function compartir() {
    try {
      await navigator.share({ text: texto });
    } catch {
      // El usuario canceló o el navegador lo rechazó: no es un error.
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      onAviso("Resultado copiado");
    } catch {
      onAviso("No se pudo copiar");
    }
  }

  const boton = "flex-1 min-w-0 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold";

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="text-center flex flex-col gap-2">
        <p
          className="text-sm font-semibold"
          style={{ color: partida.resuelta ? "var(--color-success)" : "var(--color-destructive)" }}
        >
          {partida.resuelta
            ? `¡La encontraste en ${partida.intentos.length}/${PALABRA_MAX_INTENTOS}!`
            : "¡Casi! Mañana hay una nueva palabra"}
        </p>
        {revelado && (
          <>
            <p className="text-3xl font-bold tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              {revelado.palabra}
            </p>
            <p className="text-sm" style={{ color: "var(--color-text)" }}>
              {revelado.explicacion}
            </p>
            <p
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold"
              style={{ color: "var(--color-text-muted)" }}
            >
              <BookOpen size={13} />
              {/* Al perder: el libro y capítulo de la pista, para que la busque. */}
              {partida.resuelta || !revelado.libro ? revelado.referencia : `${revelado.libro} ${revelado.capitulo}`}
            </p>
          </>
        )}
        {/* Junto al resultado: en qué lugar quedó. */}
        <button
          type="button"
          onClick={onPuntos}
          className="self-center mt-1 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{
            background: "rgba(212,160,23,0.14)",
            border: "1px solid rgba(212,160,23,0.45)",
            color: "var(--color-primary)",
          }}
        >
          <Trophy size={16} />
          Ver puntos
        </button>
      </div>

      {conSesion && partida.resuelta && (
        <div
          className="px-3 py-3 rounded-xl flex flex-col gap-2"
          style={
            vaGanando
              ? { background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.55)" }
              : { background: "var(--color-surface-elevated)" }
          }
        >
          {vaGanando && (
            <p className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
              🏆 ¡Vas ganando hoy! ¿Quieres aparecer en el video de TikTok de mañana?
            </p>
          )}
          <PermisoTikTok inicial={tiktokPermiso} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {puedeCompartir && (
            <button
              type="button"
              onClick={compartir}
              className={`${boton} basis-full sm:basis-0`}
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              <Share2 size={16} />
              Compartir
            </button>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={boton}
            style={{ background: WHATSAPP_GREEN, color: "#000" }}
          >
            <MessageCircle size={16} />
            WhatsApp
          </a>
          <button
            type="button"
            onClick={copiar}
            className={boton}
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <Copy size={16} />
            Copiar
          </button>
        </div>
      </div>

      <div
        className="text-center py-3 rounded-xl"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Siguiente palabra en
        </p>
        <p className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          <CuentaRegresiva />
        </p>
      </div>

      <PalabraEstadisticas
        estadisticas={estado.estadisticas}
        racha={estado.racha}
        resaltarIntentos={partida.resuelta ? partida.intentos.length : null}
      />

      {!conSesion && <InvitacionSesion />}
    </div>
  );
}

