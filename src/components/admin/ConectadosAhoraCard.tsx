"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { useConectadosSitio } from "./useConectadosSitio";

/** Tarjeta del Dashboard: cuántos tienen elimlldm.net abierto ahora mismo. */
export function ConectadosAhoraCard() {
  const { usuarios, visitantes, conectado } = useConectadosSitio();
  const total = usuarios.length + visitantes.length;
  const color = "var(--color-success)";

  return (
    <Link
      href="/admin/en-linea"
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 hover:opacity-80"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center ${total > 0 ? "animate-pulse" : ""}`}
        style={{ background: "rgba(74,222,128,0.12)" }}
      >
        <Activity size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          {conectado ? total : "…"}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          Conectados ahora
          {conectado && total > 0 && ` · ${usuarios.length} con cuenta, ${visitantes.length} sin cuenta`}
        </p>
      </div>
    </Link>
  );
}
