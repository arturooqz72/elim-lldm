// src/lib/ruleta/estado-puerta.server.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { STALE_GRACE_MS } from "./wheel";

export interface EstadoPuerta {
  disponible: boolean;
  jugandoAhora: number;
  esperando: number;
}

/**
 * Estado de la puerta de Ruleta para el vestíbulo de /juegos. No usa
 * getOrCreateOpenRoom() ni peekOpenRoom() a propósito — de solo lectura
 * para pintar una tarjeta, con su propia query directa (no crea ninguna
 * sala ni depende del resto de room.server.ts).
 *
 * Como tampoco llama a healStaleRuletaRooms() (igual que en Arena
 * Abierta), una sala en playing/ronda_fin cuyo deadline venció hace más de
 * STALE_GRACE_MS sin que nadie la avanzara se trata como abandonada y no
 * cuenta como "jugándose" — la sanación real la cierra en la siguiente
 * visita a /ruleta.
 */
export async function getEstadoPuertaRuleta(): Promise<EstadoPuerta> {
  const supabase = await createClient();

  const { data: salas } = await supabase
    .from("ruleta_salas")
    .select("id, status, turno_termina_en, ronda_fin_termina_en")
    .in("status", ["lobby", "playing", "ronda_fin"]);

  const now = Date.now();
  const sigueViva = (deadline: string | null) =>
    !deadline || now - new Date(deadline).getTime() < STALE_GRACE_MS;

  const hayUnaAbierta = (salas ?? []).some((s) => s.status === "lobby");
  const jugandoAhora = (salas ?? []).filter(
    (s) =>
      (s.status === "playing" && sigueViva(s.turno_termina_en)) ||
      (s.status === "ronda_fin" && sigueViva(s.ronda_fin_termina_en))
  ).length;

  // Jugadores sentados en el lobby actual esperando más gente — ver el
  // mismo patrón en arena-publica/estado-puerta.server.ts.
  const salaLobbyIds = (salas ?? []).filter((s) => s.status === "lobby").map((s) => s.id);
  let esperando = 0;
  if (salaLobbyIds.length > 0) {
    const { count } = await supabase
      .from("ruleta_jugadores")
      .select("id", { count: "exact", head: true })
      .in("sala_id", salaLobbyIds);
    esperando = count ?? 0;
  }

  return { disponible: hayUnaAbierta || jugandoAhora === 0, jugandoAhora, esperando };
}
