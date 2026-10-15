"use client";

import { Trash2 } from "lucide-react";
import type { InglesModo } from "@/types";

/** Botón del encabezado que borra la conversación del modo abierto. */
export function InglesBorrarConversacion({ modo, onBorrada }: { modo: InglesModo; onBorrada: (modo: InglesModo) => void }) {
  async function borrar() {
    if (!confirm("¿Borrar la conversación de este modo? Esto no devuelve mensajes ya usados.")) return;
    await fetch("/api/ingles/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modo }),
    });
    onBorrada(modo);
  }

  return (
    <button
      onClick={() => void borrar()}
      className="p-2 rounded-lg transition-colors shrink-0"
      style={{ color: "var(--color-text-muted)" }}
      title="Borrar conversación"
      aria-label="Borrar conversación"
    >
      <Trash2 size={16} />
    </button>
  );
}
