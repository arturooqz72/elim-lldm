// src/components/juegos/PreguntaTikTokJuego.tsx
"use client";

import { useEffect, useState } from "react";
import { PreguntaTikTok } from "./palabra/PreguntaTikTok";
import type { PalabraTikTokUsuario } from "@/types";

/**
 * La tarjeta "¿Quieres aparecer en nuestro TikTok?" al terminar una partida
 * de Trivia en línea, Ruleta o Ahorcado. Es la misma de la Palabra del Día
 * (mismo permiso y mismas reglas: no sale si ya aceptó, ni en los 7 días
 * después de un "No, gracias"). Pregunta al servidor al aparecer; sin
 * sesión o si falla, no muestra nada.
 */
export function PreguntaTikTokJuego() {
  const [usuario, setUsuario] = useState<PalabraTikTokUsuario | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/cuenta/tiktok", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<PalabraTikTokUsuario>) : null))
      .then((datos) => {
        if (vivo && datos) setUsuario(datos);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!usuario?.preguntar) return null;
  return (
    <div className="w-full max-w-md mx-auto text-left">
      <PreguntaTikTok
        nombre={usuario.nombre}
        vaGanando={false}
        titulo="¿Quieres aparecer en nuestro TikTok si quedas entre los campeones de la semana?"
      />
    </div>
  );
}
