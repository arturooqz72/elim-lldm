// src/components/juegos/palabra/PermisoTikTok.tsx
"use client";

import { useState } from "react";

/**
 * Casilla de permiso para salir en los videos de TikTok (0078). Desmarcada
 * por defecto; se guarda al tocarla. Va después de resolver la Palabra del
 * Día y en /perfil.
 */
export function PermisoTikTok({ inicial }: { inicial: boolean }) {
  const [acepta, setAcepta] = useState(inicial);
  const [estado, setEstado] = useState<"" | "guardando" | "guardado" | "error">("");

  async function cambiar(valor: boolean) {
    setAcepta(valor);
    setEstado("guardando");
    try {
      const res = await fetch("/api/cuenta/tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acepta: valor }),
      });
      if (!res.ok) throw new Error();
      setEstado("guardado");
    } catch {
      setAcepta(!valor);
      setEstado("error");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-start gap-3 cursor-pointer text-left">
        <input
          type="checkbox"
          checked={acepta}
          disabled={estado === "guardando"}
          onChange={(e) => void cambiar(e.target.checked)}
          className="mt-0.5 w-5 h-5 shrink-0 accent-[#D4A017]"
        />
        <span className="text-sm leading-snug" style={{ color: "var(--color-text)" }}>
          Acepto que mi nombre y foto aparezcan en los videos de Elim LLDM en TikTok
        </span>
      </label>
      <p className="text-[11px] pl-8" style={{ color: estado === "error" ? "var(--color-destructive)" : "var(--color-text-muted)" }}>
        {estado === "guardando"
          ? "Guardando…"
          : estado === "guardado"
            ? "Guardado. Puedes cambiarlo cuando quieras, aquí o en tu perfil."
            : estado === "error"
              ? "No se pudo guardar. Intenta de nuevo."
              : "Si no la marcas, en los videos apareces como “Hermano/a participante”, sin foto."}
      </p>
    </div>
  );
}
