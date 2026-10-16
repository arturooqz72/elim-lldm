// src/components/juegos/palabra/PreguntaTikTok.tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PermisoTikTok } from "./PermisoTikTok";

type Estado = "preguntando" | "guardando" | "si" | "no" | "error";

/**
 * Tarjeta "¿Quieres aparecer en nuestro TikTok?" después de resolver la
 * Palabra del Día, para quien todavía no da el permiso (0078). "Sí" marca
 * la misma casilla de siempre; "No, gracias" también se guarda (queda en
 * tiktok_permiso_at) y la tarjeta no vuelve a salir en 7 días. Después de
 * contestar se muestra la casilla, para que pueda cambiarlo ahí mismo.
 */
export function PreguntaTikTok({ nombre, vaGanando }: { nombre: string; vaGanando: boolean }) {
  const [estado, setEstado] = useState<Estado>("preguntando");

  async function contestar(acepta: boolean) {
    setEstado("guardando");
    try {
      const res = await fetch("/api/cuenta/tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acepta }),
      });
      if (!res.ok) throw new Error();
      setEstado(acepta ? "si" : "no");
    } catch {
      setEstado("error");
    }
  }

  if (estado === "si" || estado === "no") {
    return (
      <div className="px-3 py-3 rounded-xl flex flex-col gap-2" style={{ background: "var(--color-surface-elevated)" }}>
        <p className="text-sm font-semibold" style={{ color: estado === "si" ? "var(--color-primary)" : "var(--color-text)" }}>
          {estado === "si"
            ? `¡Listo! Si ganas, aparecerás como “${nombre}”. 🙌`
            : "Entendido. Si ganas, aparecerás como “Hermano/a participante”."}
        </p>
        <PermisoTikTok inicial={estado === "si"} />
      </div>
    );
  }

  const ocupado = estado === "guardando";
  return (
    <div
      className="px-4 py-4 rounded-xl flex flex-col gap-3"
      style={{ background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.55)" }}
    >
      {vaGanando && (
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>
          ¡Vas ganando hoy!
        </p>
      )}
      <p className="text-base font-bold leading-snug" style={{ color: "var(--color-text)" }}>
        🏆 ¿Quieres aparecer en nuestro TikTok si eres el ganador del día?
      </p>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Tu nombre aparecerá como <strong style={{ color: "var(--color-primary)" }}>“{nombre}”</strong>, con tu foto de perfil.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void contestar(true)}
          className="min-h-11 px-3 py-2.5 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          {ocupado && <Loader2 size={15} className="animate-spin" />}
          Sí, quiero aparecer
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void contestar(false)}
          className="min-h-11 px-3 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
          style={{ background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
        >
          No, gracias
        </button>
      </div>
      {estado === "error" && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          No se pudo guardar. Intenta de nuevo.
        </p>
      )}
      <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        Puedes cambiarlo cuando quieras en tu perfil.
      </p>
    </div>
  );
}
