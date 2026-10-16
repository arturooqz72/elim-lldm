// src/lib/arena-publica/estado-puerta.server.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { STALE_GRACE_MS } from "./config";

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
 * Como tampoco llama a healStaleRooms(), una sala en playing/reveal cuyo
 * deadline venció hace más de STALE_GRACE_MS sin que nadie la avanzara se
 * trata como abandonada y no cuenta como "jugándose" — la sanación real la
 * cierra en la siguiente visita a /arena-abierta.
 */
export async function getEstadoPuertaArenaAbierta(): Promise<EstadoPuerta> {
  const supabase = await createClient();

  const { data: salas } = await supabase
    .from("arena_publica_salas")
    .select("id, status, pregunta_termina_en, reveal_termina_en")
    .in("status", ["lobby", "counting", "playing", "reveal"]);

  const now = Date.now();
  const sigueViva = (deadline: string | null) =>
    !deadline || now - new Date(deadline).getTime() < STALE_GRACE_MS;

  const hayUnaAbierta = (salas ?? []).some((s) => s.status === "lobby" || s.status === "counting");
  const jugandoAhora = (salas ?? []).filter(
    (s) =>
      (s.status === "playing" && sigueViva(s.pregunta_termina_en)) ||
      (s.status === "reveal" && sigueViva(s.reveal_termina_en))
  ).length;

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
