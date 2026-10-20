// src/components/juegos/PermisoVideosJuegos.tsx
"use client";

import { createContext, useContext, useId, useState } from "react";
import Link from "next/link";
import { TEXTO_PERMISO_VIDEOS } from "@/lib/juegos/permiso-videos";

type Modo = "casilla" | "iniciar-sesion" | "oculto";

interface PermisoCompartido {
  modo: Modo;
  acepta: boolean;
  guardando: boolean;
  cambiar: (valor: boolean) => Promise<boolean>;
}

const PermisoContext = createContext<PermisoCompartido | null>(null);

/**
 * Un solo permiso (profiles.tiktok_permiso) para todas las tarjetas de
 * /juegos: si se marca en un juego, queda marcado en todos. Los admins no
 * compiten, así que para ellos no se muestra ("oculto"); sin sesión se
 * muestra el enlace para iniciarla.
 */
export function PermisoVideosProvider({
  modo,
  inicial,
  children,
}: {
  modo: Modo;
  inicial: boolean;
  children: React.ReactNode;
}) {
  const [acepta, setAcepta] = useState(inicial);
  const [guardando, setGuardando] = useState(false);

  async function cambiar(valor: boolean): Promise<boolean> {
    const anterior = acepta;
    setAcepta(valor);
    setGuardando(true);
    try {
      const res = await fetch("/api/cuenta/tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acepta: valor }),
      });
      if (!res.ok) throw new Error();
      return true;
    } catch {
      setAcepta(anterior);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  return (
    <PermisoContext.Provider value={{ modo, acepta, guardando, cambiar }}>{children}</PermisoContext.Provider>
  );
}

/** La casilla debajo de los botones de cada juego. El aviso sale solo en la que se tocó. */
export function CasillaPermisoJuego() {
  const permiso = useContext(PermisoContext);
  const id = useId();
  const [aviso, setAviso] = useState<"" | "guardado" | "error">("");

  if (!permiso || permiso.modo === "oculto") return null;

  if (permiso.modo === "iniciar-sesion") {
    return (
      <div className="relative z-10 pt-3 text-xs" style={{ borderTop: "1px solid var(--color-border)" }}>
        <Link
          href="/login?returnUrl=/juegos"
          className="inline-flex items-center min-h-11 font-semibold underline underline-offset-2"
          style={{ color: "var(--color-primary)" }}
        >
          Inicia sesión para aparecer en los videos de campeones
        </Link>
      </div>
    );
  }

  async function tocar(valor: boolean) {
    setAviso("");
    const ok = await permiso!.cambiar(valor);
    setAviso(ok ? "guardado" : "error");
  }

  return (
    <div className="relative z-10 pt-3 flex flex-col gap-1" style={{ borderTop: "1px solid var(--color-border)" }}>
      <label htmlFor={id} className="flex items-start gap-3 cursor-pointer min-h-11 py-1 text-left">
        <input
          id={id}
          type="checkbox"
          checked={permiso.acepta}
          disabled={permiso.guardando}
          onChange={(e) => void tocar(e.target.checked)}
          className="mt-0.5 w-6 h-6 shrink-0 cursor-pointer accent-[#D4A017]"
        />
        <span className="text-xs leading-snug" style={{ color: "var(--color-text)" }}>
          {TEXTO_PERMISO_VIDEOS}
        </span>
      </label>
      {aviso && (
        <p
          role="status"
          className="text-xs pl-9"
          style={{ color: aviso === "error" ? "var(--color-destructive)" : "var(--color-success)" }}
        >
          {aviso === "guardado" ? "✅ Guardado" : "No se pudo guardar. Intenta de nuevo."}
        </p>
      )}
    </div>
  );
}
