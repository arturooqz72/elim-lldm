"use client";

import { useEffect, useState } from "react";
import { Flame, Share2 } from "lucide-react";
import type { InglesRacha } from "@/types";

const GOLD = "#f5c842";

function dias(n: number): string {
  return `${n} ${n === 1 ? "día" : "días"}`;
}

/** Felicitación al completar el Reto del día, con la racha y botón para compartir por WhatsApp. */
export function InglesRetoLogro({ racha }: { racha: InglesRacha }) {
  const [enlace, setEnlace] = useState("https://www.elimlldm.net/ingles");
  useEffect(() => setEnlace(`${window.location.origin}/ingles`), []);

  const n = Math.max(1, racha.actual);
  const texto = `Llevo ${dias(n)} practicando inglés en Elim English ${enlace}`;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-start gap-3"
      style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}55` }}
    >
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        🎉 ¡Completaste el reto de hoy!
      </p>
      <p className="text-sm flex items-center gap-1.5" style={{ color: "var(--color-text)" }}>
        <Flame size={16} style={{ color: GOLD }} />
        {n === 1 ? "Empezaste tu racha: 1 día practicando." : `Llevas ${dias(n)} seguidos practicando.`} Vuelve mañana
        por el siguiente reto.
      </p>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
        style={{ background: "#25D366", color: "#000" }}
      >
        <Share2 size={15} />
        Compartir por WhatsApp
      </a>
    </div>
  );
}
