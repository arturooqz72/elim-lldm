// src/components/juegos/palabra/PalabraResultado.tsx
"use client";

import { useEffect, useState } from "react";
import { BookOpen, Copy, MessageCircle, Share2 } from "lucide-react";
import { PALABRA_MAX_INTENTOS } from "@/lib/palabra/config";
import { textoParaCompartir } from "@/lib/palabra/logica";
import type { PalabraEstadoJugador, PalabraPartidaEstado, PalabraRevelada } from "@/types";
import { CuentaRegresiva } from "./CuentaRegresiva";
import { PalabraEstadisticas } from "./PalabraEstadisticas";
import { InvitacionSesion } from "./InvitacionSesion";

const WHATSAPP_GREEN = "#25D366";

interface PalabraResultadoProps {
  fecha: string;
  partida: PalabraPartidaEstado;
  revelado: PalabraRevelada | null;
  estado: PalabraEstadoJugador;
  conSesion: boolean;
  onAviso: (mensaje: string) => void;
}

export function PalabraResultado({ fecha, partida, revelado, estado, conSesion, onAviso }: PalabraResultadoProps) {
  // navigator.share solo existe en el cliente: se detecta después de
  // montar para que el HTML del servidor y la hidratación coincidan.
  const [puedeCompartir, setPuedeCompartir] = useState(false);
  useEffect(() => {
    setPuedeCompartir(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const texto = textoParaCompartir({
    fecha,
    intentos: partida.intentos,
    resuelta: partida.resuelta,
    racha: estado.racha.actual,
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
            : "Esta vez no fue — ¡mañana hay otra!"}
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
              {revelado.referencia}
            </p>
          </>
        )}
      </div>

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

