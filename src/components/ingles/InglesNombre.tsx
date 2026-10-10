"use client";

import { PedirNombre } from "@/components/auth/PedirNombre";
import { InglesEncabezado } from "./InglesEncabezado";

const GOLD = "#f5c842";

/**
 * /ingles con una cuenta que todavía no puso su nombre (se fue antes de
 * ponerlo al entrar con el código): se pide antes de la tutora.
 */
export function InglesNombre() {
  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: `1px solid ${GOLD}33` }}
    >
      <InglesEncabezado subtitulo="Tu tutora de inglés con IA" />
      <div className="flex-1 overflow-y-auto px-5 py-8 flex flex-col items-center">
        <PedirNombre onListo={() => window.location.replace("/ingles")} />
      </div>
    </div>
  );
}
