// src/lib/arena-publica/estado-puerta.server.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface EstadoPuerta {
  disponible: boolean;
  jugandoAhora: number;
}

/**
 * Estado de la puerta de Arena Abierta para el vestíbulo de /juegos. No usa
 * getOrCreateOpenRoom() a propósito — esto es de solo lectura para pintar
 * una tarjeta, no debe crear una sala nueva solo porque alguien pasó por
 * /juegos sin intención de entrar.
 */
export async function getEstadoPuertaArenaAbierta(): Promise<EstadoPuerta> {
  const supabase = await createClient();

  const { data: salas } = await supabase
    .from("arena_publica_salas")
    .select("status")
    .in("status", ["lobby", "counting", "playing", "reveal"]);

  const hayUnaAbierta = (salas ?? []).some((s) => s.status === "lobby" || s.status === "counting");
  const jugandoAhora = (salas ?? []).filter((s) => s.status === "playing" || s.status === "reveal").length;

  return { disponible: hayUnaAbierta || jugandoAhora === 0, jugandoAhora };
}
