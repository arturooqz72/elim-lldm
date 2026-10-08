// src/components/juegos/palabra/PalabraAyuda.tsx
import { PALABRA_DIAS_POR_COMODIN, PALABRA_FALLOS_SEGUNDA_PISTA, PALABRA_MAX_COMODINES } from "@/lib/palabra/config";
import type { PalabraColor } from "@/types";
import { COLOR_FONDO } from "./colores";

function Ejemplo({ palabra, resaltar, color }: { palabra: string; resaltar: number; color: PalabraColor }) {
  return (
    <div className="flex gap-1 my-2">
      {[...palabra].map((letra, i) => (
        <div
          key={i}
          className="w-9 h-9 flex items-center justify-center rounded-md font-bold text-sm"
          style={{
            color: "var(--color-text)",
            background: i === resaltar ? COLOR_FONDO[color] : "var(--color-surface-elevated)",
            border: `2px solid ${i === resaltar ? "transparent" : "var(--color-border)"}`,
          }}
        >
          {letra}
        </div>
      ))}
    </div>
  );
}

export function PalabraAyuda() {
  const texto = { color: "var(--color-text)" } as const;
  const tenue = { color: "var(--color-text-muted)" } as const;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p style={texto}>
        Adivina la <strong>palabra bíblica del día</strong> en 6 intentos. Es la misma para todos y
        cambia a medianoche (hora del Pacífico).
      </p>
      <ul className="list-disc pl-5 flex flex-col gap-1" style={texto}>
        <li>Cada intento debe ser una palabra válida de 5 letras.</li>
        <li>Los acentos no importan (á = a). La Ñ sí cuenta como letra.</li>
        <li>Después de cada intento, los colores te dicen qué tan cerca estás.</li>
        <li>
          Pistas gratis: arriba del tablero ves si la palabra es persona, lugar, objeto, acción o
          concepto, y después de {PALABRA_FALLOS_SEGUNDA_PISTA} intentos fallidos, el libro y
          capítulo de la Biblia donde aparece. No restan puntos.
        </li>
      </ul>

      <div>
        <Ejemplo palabra="SALMO" resaltar={0} color="correct" />
        <p style={tenue}>
          <strong style={texto}>S</strong> está en la palabra y en el lugar correcto.
        </p>
        <Ejemplo palabra="MONTE" resaltar={1} color="present" />
        <p style={tenue}>
          <strong style={texto}>O</strong> está en la palabra, pero en otra posición.
        </p>
        <Ejemplo palabra="REINO" resaltar={3} color="absent" />
        <p style={tenue}>
          <strong style={texto}>N</strong> no está en la palabra.
        </p>
      </div>

      <div
        className="p-3 rounded-xl"
        style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.25)" }}
      >
        <p className="font-semibold mb-1" style={{ color: "var(--color-primary)" }}>
          🔥 Racha y 🛡️ comodines
        </p>
        <p style={texto}>
          Juega todos los días para subir tu racha. Por cada {PALABRA_DIAS_POR_COMODIN} días seguidos
          ganas un comodín (máximo {PALABRA_MAX_COMODINES}) que protege tu racha automáticamente si
          un día no puedes jugar.
        </p>
      </div>

      <p style={tenue}>
        Al terminar verás la palabra, una breve explicación y la cita bíblica donde aparece.
      </p>
    </div>
  );
}
