// src/lib/ruleta/estado-puerta.server.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface EstadoPuerta {
  disponible: boolean;
  jugandoAhora: number;
}

/**
 * Estado de la puerta de Ruleta para el vestíbulo de /juegos. No usa
 * getOrCreateOpenRoom() ni peekOpenRoom() a propósito — de solo lectura
 * para pintar una tarjeta, con su propia query directa (no crea ninguna
 * sala ni depende del resto de room.server.ts).
 *
 * Tradeoff conocido (igual que en Arena Abierta): al no llamar a
 * healStaleRuletaRooms() aquí, una sala atascada en playing/ronda_fin tras
 * su deadline seguirá mostrando "Ocupado" hasta que alguien visite /ruleta
 * y dispare la sanación ahí.
 */
export async function getEstadoPuertaRuleta(): Promise<EstadoPuerta> {
  const supabase = await createClient();

  const { data: salas } = await supabase
    .from("ruleta_salas")
    .select("status")
    .in("status", ["lobby", "playing", "ronda_fin"]);

  const hayUnaAbierta = (salas ?? []).some((s) => s.status === "lobby");
  const jugandoAhora = (salas ?? []).filter((s) => s.status === "playing" || s.status === "ronda_fin").length;

  return { disponible: hayUnaAbierta || jugandoAhora === 0, jugandoAhora };
}
