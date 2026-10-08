"use client";

import { useState } from "react";
import { Mic, Square } from "lucide-react";
import { useDictado } from "./useDictado";

interface ResolverPanelProps {
  onResolver: (respuesta: string) => Promise<void>;
}

/** Campo para resolver el panel escribiendo o dictando con el micrófono. */
export function ResolverPanel({ onResolver }: ResolverPanelProps) {
  const [texto, setTexto] = useState("");
  const { soportado, escuchando, error, iniciar, detener } = useDictado(setTexto);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const respuesta = texto.trim();
    if (!respuesta) return;
    detener();
    await onResolver(respuesta);
    setTexto("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={enviar} className="flex gap-2">
        {soportado && (
          <button
            type="button"
            onClick={escuchando ? detener : iniciar}
            aria-label={escuchando ? "Dejar de escuchar" : "Contestar con voz"}
            title={escuchando ? "Dejar de escuchar" : "Contestar con voz"}
            className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${escuchando ? "animate-pulse" : ""}`}
            style={
              escuchando
                ? { background: "var(--color-live)", color: "#fff" }
                : { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-primary)" }
            }
          >
            {escuchando ? <Square size={15} fill="currentColor" /> : <Mic size={18} />}
          </button>
        )}
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={soportado ? "Escribe o dicta la frase" : "Resolver panel: escribe la frase completa"}
          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          Resolver
        </button>
      </form>
      {escuchando && (
        <p className="text-xs text-center" style={{ color: "var(--color-live)" }}>
          Escuchando… di la frase completa y luego toca Resolver.
        </p>
      )}
      {error && !escuchando && (
        <p className="text-xs text-center" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
