// src/lib/arena-publica/estado-puerta.server.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface EstadoPuerta {
  disponible: boolean;
  jugandoAhora: number;
  esperando: number;
}

/**
 * Estado de la puerta de Arena Abierta para el vestíbulo de /juegos. No usa
 * getOrCreateOpenRoom() a propósito — esto es de solo lectura para pintar
 * una tarjeta, no debe crear una sala nueva solo porque alguien pasó por
 * /juegos sin intención de entrar.
 *
 * Tradeoff conocido: al no llamar a healStaleRooms() (a diferencia de
 * getOrCreateOpenRoom() en room.server.ts), una sala atascada en
 * playing/reveal tras su deadline seguirá mostrando "Ocupado" aquí hasta
 * que alguien visite /arena-abierta y dispare la sanación ahí.
 */
export async function getEstadoPuertaArenaAbierta(): Promise<EstadoPuerta> {
  const supabase = await createClient();

  const { data: salas } = await supabase
    .from("arena_publica_salas")
    .select("id, status")
    .in("status", ["lobby", "counting", "playing", "reveal"]);

  const hayUnaAbierta = (salas ?? []).some((s) => s.status === "lobby" || s.status === "counting");
  const jugandoAhora = (salas ?? []).filter((s) => s.status === "playing" || s.status === "reveal").length;

  // Jugadores sentados en el lobby actual esperando más gente — para
  // mostrar "N esperando" en la puerta (ver GameNotifyBell.tsx). Si hay
  // más de una sala 'lobby' a la vez (no debería, hay un índice único
  // parcial que lo evita), se suman todas.
  const salaLobbyIds = (salas ?? []).filter((s) => s.status === "lobby").map((s) => s.id);
  let esperando = 0;
  if (salaLobbyIds.length > 0) {
    const { count } = await supabase
      .from("arena_publica_jugadores")
      .select("id", { count: "exact", head: true })
      .in("sala_id", salaLobbyIds);
    esperando = count ?? 0;
  }

  return { disponible: hayUnaAbierta || jugandoAhora === 0, jugandoAhora, esperando };
}
