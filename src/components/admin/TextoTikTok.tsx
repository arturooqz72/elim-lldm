// src/components/admin/TextoTikTok.tsx
"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Descripción lista para pegar, con su botón de copiar (TikTok, Instagram o YouTube). */
export function TextoTikTok({
  texto,
  titulo = "Descripción para TikTok",
  boton = "Copiar texto",
  filas = 11,
}: {
  texto: string;
  titulo?: string;
  boton?: string;
  filas?: number;
}) {
  const [copiado, setCopiado] = useState(false);
  const caja = useRef<HTMLTextAreaElement>(null);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin permiso de portapapeles: se deja seleccionado para Ctrl+C.
      caja.current?.focus();
      caja.current?.select();
      document.execCommand?.("copy");
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {titulo}
        </p>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        >
          {copiado ? <Check size={15} style={{ color: "var(--color-success)" }} /> : <Copy size={15} />}
          {copiado ? "¡Copiado!" : boton}
        </button>
      </div>
      <textarea
        ref={caja}
        readOnly
        value={texto}
        rows={filas}
        className="w-full px-3 py-2 rounded-lg text-sm leading-relaxed resize-none"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
      />
    </div>
  );
}
