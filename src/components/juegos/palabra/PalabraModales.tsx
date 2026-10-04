// src/components/juegos/palabra/PalabraModales.tsx
import type { PalabraEstadoJugador, PalabraPartidaEstado } from "@/types";
import { PalabraModal } from "./PalabraModal";
import { PalabraAyuda } from "./PalabraAyuda";
import { PalabraEstadisticas } from "./PalabraEstadisticas";

interface PalabraModalesProps {
  modal: "ayuda" | "estadisticas" | null;
  estado: PalabraEstadoJugador | null;
  partida: PalabraPartidaEstado;
  conSesion: boolean;
  onCerrar: () => void;
}

/** "Cómo jugar" y "Estadísticas" del juego (uno a la vez). */
export function PalabraModales({ modal, estado, partida, conSesion, onCerrar }: PalabraModalesProps) {
  if (modal === "ayuda") {
    return (
      <PalabraModal titulo="Cómo jugar" onCerrar={onCerrar}>
        <PalabraAyuda />
        <button
          type="button"
          onClick={onCerrar}
          className="w-full mt-5 py-3 rounded-xl text-sm font-bold"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          ¡A jugar!
        </button>
      </PalabraModal>
    );
  }

  if (modal === "estadisticas" && estado) {
    return (
      <PalabraModal titulo="Estadísticas" onCerrar={onCerrar}>
        <PalabraEstadisticas
          estadisticas={estado.estadisticas}
          racha={estado.racha}
          resaltarIntentos={partida.resuelta ? partida.intentos.length : null}
        />
        {!conSesion && (
          <p className="text-xs mt-4 text-center" style={{ color: "var(--color-text-muted)" }}>
            Sin sesión, tus estadísticas solo se guardan en este dispositivo.
          </p>
        )}
      </PalabraModal>
    );
  }

  return null;
}
