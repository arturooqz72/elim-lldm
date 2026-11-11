// src/lib/liga/registrar.server.ts
//
// Único punto por donde entran puntos a la Liga. Lo llaman las rutas de
// cada juego DESPUÉS de validar el resultado en el servidor, con after()
// para no retrasar la respuesta. Nunca lanza.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { LIGA_MAX_POR_PARTIDA, LIGA_TOPE_DIARIO, type JuegoLiga } from "./config";

export interface PuntosLiga {
  jugador: string | null | undefined;
  juego: JuegoLiga;
  puntos: number;
  partidaRef: string;
  eventoRef: string;
}

export async function registrarPuntosLiga(p: PuntosLiga): Promise<number> {
  if (!p.jugador || !(p.puntos > 0)) return 0;
  try {
    const service = await createServiceClient();
    const { data, error } = await service.rpc("liga_registrar_puntos", {
      p_jugador: p.jugador,
      p_juego: p.juego,
      p_puntos: Math.floor(p.puntos),
      p_partida: p.partidaRef,
      p_evento: p.eventoRef,
      p_max_partida: LIGA_MAX_POR_PARTIDA[p.juego],
      p_tope_dia: LIGA_TOPE_DIARIO,
    });
    if (error) {
      console.error("[liga] No se pudieron registrar puntos:", error.message);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (e) {
    console.error("[liga] Error al registrar puntos:", e);
    return 0;
  }
}
