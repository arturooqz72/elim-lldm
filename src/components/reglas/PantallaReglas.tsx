// src/components/reglas/PantallaReglas.tsx
//
// Para quien tiene sesión y todavía no acepta la regla: una pantalla con
// la regla, su nombre para mostrar y "Acepto". Si dice "Ahora no", puede
// ver la página pero queda una barra abajo para aceptar (el servidor no
// le deja empezar partidas). Se cierra por sesión del navegador para no
// abrirse en cada página.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScrollText } from "lucide-react";
import { NOMBRE_MAX, NOMBRE_MIN, NOTA_NOMBRE_PARA_MOSTRAR, REGLAS_VERSION, TEXTO_PARA_TODOS, TEXTO_REGLA_PARTICIPACION } from "@/lib/reglas";

const CLAVE = "elim-reglas-ahora-no";

export function PantallaReglas({ nombreInicial }: { nombreInicial: string }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [nombre, setNombre] = useState(nombreInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cerrada = false;
    try {
      cerrada = sessionStorage.getItem(CLAVE) === REGLAS_VERSION;
    } catch {
      cerrada = false;
    }
    setAbierta(!cerrada);
  }, []);

  function ahoraNo() {
    try {
      sessionStorage.setItem(CLAVE, REGLAS_VERSION);
    } catch {
      // Sin almacenamiento: se vuelve a mostrar en la siguiente página.
    }
    setAbierta(false);
  }

  async function aceptar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/cuenta/reglas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: REGLAS_VERSION, display_name: nombre }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setGuardando(false);
    }
  }

  const largo = nombre.trim().length;
  const nombreOk = largo >= NOMBRE_MIN && largo <= NOMBRE_MAX;

  if (!abierta) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-40 p-3" style={{ background: "rgba(10,10,18,0.95)", borderTop: "1px solid rgba(212,160,23,0.4)" }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <p className="flex-1 text-sm" style={{ color: "var(--color-text)" }}>Para jugar, acepta las reglas de los juegos.</p>
          <button type="button" onClick={() => setAbierta(true)} className="px-4 py-2.5 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
            Ver reglas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} role="dialog" aria-modal="true" aria-labelledby="reglas-titulo">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--color-surface)", border: "1px solid rgba(212,160,23,0.4)" }}>
        <div className="flex items-center gap-2">
          <ScrollText size={20} style={{ color: "var(--color-primary)" }} />
          <h2 id="reglas-titulo" className="text-lg font-bold" style={{ color: "var(--color-text)" }}>Reglas de los juegos</h2>
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{TEXTO_PARA_TODOS}</p>
        <p className="text-sm p-3 rounded-xl" style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}>{TEXTO_REGLA_PARTICIPACION}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Nombre para mostrar</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={NOMBRE_MAX}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{NOTA_NOMBRE_PARA_MOSTRAR}. Puede ser tu nombre o un apodo, por ejemplo &quot;Hermano Juan GDL&quot;.</span>
        </label>
        {error && <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{error}</p>}
        <button type="button" disabled={!nombreOk || guardando} onClick={() => void aceptar()} className="py-3 rounded-xl text-sm font-bold min-h-11 disabled:opacity-60" style={{ background: "var(--color-primary)", color: "#000" }}>
          {guardando ? "Guardando…" : "Acepto"}
        </button>
        <div className="flex items-center justify-between text-sm">
          <Link href="/reglas" className="underline min-h-11 inline-flex items-center" style={{ color: "var(--color-primary)" }}>Ver todas las reglas</Link>
          <button type="button" onClick={ahoraNo} className="underline min-h-11" style={{ color: "var(--color-text-muted)" }}>Ahora no, solo quiero ver</button>
        </div>
      </div>
    </div>
  );
}
