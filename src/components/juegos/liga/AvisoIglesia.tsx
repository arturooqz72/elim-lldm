// src/components/juegos/liga/AvisoIglesia.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { enFrase } from "@/lib/liga/nombre";
import { SelectorIglesia, type IglesiaElegida } from "./SelectorIglesia";

export function AvisoIglesia() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(true);
  const [elegida, setElegida] = useState<IglesiaElegida | null>(null);
  if (!abierto) return null;

  async function ahoraNo() {
    setAbierto(false);
    try {
      await fetch("/api/liga/no-preguntar", { method: "POST" });
    } catch {
      // Si falla, se le vuelve a preguntar la próxima vez.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} role="dialog" aria-modal="true" aria-labelledby="aviso-iglesia-titulo">
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--color-surface)", border: "1px solid rgba(212,160,23,0.4)" }}>
        {elegida ? (
          <>
            <p id="aviso-iglesia-titulo" className="text-lg font-bold" style={{ color: "var(--color-text)" }}>¡Listo! 🙌</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {elegida.aprobada
                ? `Tus puntos sumarán para ${enFrase(elegida.nombre, elegida.comunidad)}.`
                : `Agregamos ${enFrase(elegida.nombre, elegida.comunidad)}. Cuando la aprobemos, tus puntos empezarán a sumar.`}
            </p>
            <button type="button" onClick={() => { setAbierto(false); router.refresh(); }} className="py-2.5 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
              A jugar
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Trophy size={20} style={{ color: "var(--color-primary)" }} />
              <p id="aviso-iglesia-titulo" className="text-lg font-bold" style={{ color: "var(--color-text)" }}>En Elim LLDM todos son bienvenidos. ¿De qué iglesia eres?</p>
            </div>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Tus puntos sumarán para tu equipo en la Liga.</p>
            <SelectorIglesia onElegida={setElegida} />
            <button type="button" onClick={() => void ahoraNo()} className="text-sm underline min-h-11" style={{ color: "var(--color-text-muted)" }}>Ahora no</button>
          </>
        )}
      </div>
    </div>
  );
}
