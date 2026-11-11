"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NOTA_NOMBRE_PARA_MOSTRAR, REGLAS_VERSION, TEXTO_REGLA_PARTICIPACION } from "@/lib/reglas";

const GOLD = "#f5c842";

/**
 * Pide el nombre a una cuenta recién creada con el código por correo (que
 * nace con la parte del correo antes de la @ como nombre). Se usa en /login,
 * en la app de Elim English y en /ingles si alguien se fue sin ponerlo.
 */
export function PedirNombre({ onListo, conReglas = false }: { onListo: () => void; conReglas?: boolean }) {
  const [nombre, setNombre] = useState("");
  // Solo en /login (registro): "Acepto" de la regla de los juegos, sin marcar.
  const [acepto, setAcepto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hasta que React toma la página, lo que se escriba se perdería: el campo espera.
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/cuenta/nombre", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar. Intenta de nuevo.");
      if (conReglas) {
        const r = await fetch("/api/cuenta/reglas", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: REGLAS_VERSION, display_name: nombre }),
        });
        const d = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(d.error ?? "No se pudo guardar. Intenta de nuevo.");
      }
      onListo();
    } catch (e) {
      setGuardando(false);
      setError(e instanceof Error ? e.message : "No se pudo guardar. Intenta de nuevo.");
    }
  }

  return (
    <form
      className="w-full flex flex-col items-center text-center gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <div className="text-4xl" aria-hidden>
        🙏
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold leading-tight" style={{ color: "var(--color-text)" }}>
          La Paz del Señor. ¿Cómo te llamas?
        </h2>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Así te saludará la tutora y así aparecerás en Elim LLDM.
        </p>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-3">
        <input
          type="text"
          autoComplete="name"
          placeholder="Tu nombre"
          maxLength={40}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-base outline-none"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
          aria-label="Tu nombre"
          disabled={!listo}
        />
        {conReglas && (
          <>
            <p className="text-xs text-left" style={{ color: "var(--color-text-muted)" }}>
              {NOTA_NOMBRE_PARA_MOSTRAR}. Puede ser tu nombre o un apodo.
            </p>
            <label
              className="flex items-start gap-3 p-3 rounded-xl text-sm text-left cursor-pointer"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              <input
                type="checkbox"
                checked={acepto}
                onChange={(e) => setAcepto(e.target.checked)}
                className="mt-1 w-4 h-4 shrink-0 accent-[#D4A017]"
              />
              <span>
                <strong>Acepto.</strong> {TEXTO_REGLA_PARTICIPACION}{" "}
                <Link href="/reglas" target="_blank" className="underline" style={{ color: "var(--color-primary)" }}>
                  Ver reglas
                </Link>
              </span>
            </label>
          </>
        )}
        {error && (
          <p className="text-sm" style={{ color: "var(--color-destructive)" }} role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={guardando || nombre.trim().length < 2 || (conReglas && !acepto)}
          className="w-full py-3.5 rounded-xl text-base font-bold disabled:opacity-60"
          style={{ background: GOLD, color: "#000" }}
        >
          {guardando ? "Guardando…" : "Empezar"}
        </button>
      </div>
    </form>
  );
}
