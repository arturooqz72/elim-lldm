// src/components/juegos/liga/CambiarIglesia.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SelectorIglesia } from "./SelectorIglesia";

export function CambiarIglesia({ nombre, aprobada, puedeElegir }: { nombre: string | null; aprobada: boolean; puedeElegir: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  if (abierto) {
    return (
      <div className="flex flex-col gap-3">
        <SelectorIglesia onElegida={() => { setAbierto(false); router.refresh(); }} />
        <button type="button" onClick={() => setAbierto(false)} className="text-sm underline min-h-11" style={{ color: "var(--color-text-muted)" }}>Cancelar</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <p className="flex-1 text-sm" style={{ color: "var(--color-text)" }}>
        {nombre ? <>{nombre}{!aprobada && <span style={{ color: "var(--color-text-muted)" }}> · esperando aprobación</span>}</> : <span style={{ color: "var(--color-text-muted)" }}>Todavía no eliges tu equipo</span>}
      </p>
      {puedeElegir && (
        <button type="button" onClick={() => setAbierto(true)} className="px-3 py-2 rounded-lg text-sm font-semibold min-h-11" style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-primary)" }}>
          {nombre ? "Cambiar" : "Elegir"}
        </button>
      )}
    </div>
  );
}
