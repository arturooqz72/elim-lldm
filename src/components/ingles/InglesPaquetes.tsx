"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { ETIQUETA_PAQUETE, formatoPrecio } from "@/lib/ingles/etiquetas";
import type { InglesPaquete, InglesPaqueteId } from "@/types";

const GOLD = "#f5c842";

interface Props {
  paquetes: InglesPaquete[];
  gratisDiarios: number;
}

/** Aviso de límite alcanzado con los paquetes para comprar (Stripe Checkout). */
export function InglesPaquetes({ paquetes, gratisDiarios }: Props) {
  const [comprando, setComprando] = useState<InglesPaqueteId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function comprar(id: InglesPaqueteId) {
    setComprando(id);
    setError(null);
    try {
      const res = await fetch("/api/ingles/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paquete: id }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "No se pudo iniciar el pago");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago");
      setComprando(null);
    }
  }

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: `${GOLD}0F`, border: `1px solid ${GOLD}55` }}>
      <div>
        <p className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--color-text)" }}>
          <Sparkles size={15} style={{ color: GOLD }} />
          Llegaste al límite de hoy
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Tus {gratisDiarios} mensajes gratis se renuevan a medianoche (hora del Pacífico). Si quieres seguir practicando
          ahora, puedes comprar un paquete de mensajes. Pago único, no es suscripción.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {paquetes.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => comprar(p.id)}
            disabled={comprando !== null}
            className="rounded-xl px-4 py-3 text-left transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
          >
            <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>
              {ETIQUETA_PAQUETE[p.id]}
            </span>
            <span className="block text-base font-bold" style={{ color: "var(--color-text)" }}>
              {p.mensajes.toLocaleString("es-MX")} mensajes
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: GOLD }}>
              {formatoPrecio(p.precioCentavos, p.moneda)}
              {comprando === p.id && <Loader2 size={14} className="animate-spin" />}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        El pago lo procesa Stripe; nunca vemos los datos de tu tarjeta. Al comprar aceptas los{" "}
        <Link href="/ingles/terminos" className="underline">
          términos de uso y la política de reembolso
        </Link>
        .
      </p>
    </div>
  );
}
