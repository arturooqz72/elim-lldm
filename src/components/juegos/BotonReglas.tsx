"use client";

import { useCallback, useState } from "react";
import { BookOpen } from "lucide-react";
import { PalabraModal } from "./palabra/PalabraModal";

interface BotonReglasProps {
  /** Nombre del juego, para el título de la ventana. */
  juego: string;
  /** "boton" iguala el tamaño de los botones grandes de las tarjetas. */
  variante?: "pill" | "boton";
  children: React.ReactNode;
}

/** Botón "Reglas" que abre una ventana con cómo se juega. */
export function BotonReglas({ juego, variante = "pill", children }: BotonReglasProps) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAbierto(true);
        }}
        aria-label={`Reglas de ${juego}`}
        className={`relative z-10 shrink-0 flex items-center font-semibold ${
          variante === "boton" ? "gap-1.5 px-4 py-2.5 rounded-xl text-sm" : "gap-1 px-2.5 py-1 rounded-full text-xs"
        }`}
        style={{
          background: "rgba(212,160,23,0.1)",
          border: "1px solid rgba(212,160,23,0.3)",
          color: "var(--color-primary)",
        }}
      >
        <BookOpen size={13} />
        Reglas
      </button>
      {abierto && (
        <PalabraModal titulo={`Cómo se juega: ${juego}`} onCerrar={cerrar}>
          {children}
        </PalabraModal>
      )}
    </>
  );
}
