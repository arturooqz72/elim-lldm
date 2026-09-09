// src/lib/juegos/tabla-posiciones.server.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FilaPosicion, JuegoConTabla } from "@/types";

/**
 * Tabla de posiciones global de un juego, de mayor a menor puntaje.
 *
 * Lee la vista `tabla_posiciones` (0029_tabla_posiciones.sql), que suma los
 * puntos de todas las partidas TERMINADAS de cada miembro. No escribe nada:
 * los puntos ya los guardan las rutas de API de cada juego al responder.
 *
 * Usa el cliente anónimo a propósito (no el service role): la vista es
 * security_invoker y sus tablas de origen son públicamente legibles, así que
 * un visitante sin cuenta también ve la tabla — que es justamente el gancho.
 *
 * Empates: a igual puntaje va primero quien lo logró en menos partidas, y a
 * igualdad total se ordena por nombre para que el orden sea estable entre
 * recargas (sin este desempate, Postgres podría devolverlos en orden distinto
 * cada vez y el ranking "bailaría" sin que nadie hubiera jugado).
 */
export async function getTablaPosiciones(
  juego: JuegoConTabla,
  limite = 10
): Promise<FilaPosicion[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tabla_posiciones")
    .select("user_id, nombre, avatar_url, puntos_totales, partidas")
    .eq("juego", juego)
    .order("puntos_totales", { ascending: false })
    .order("partidas", { ascending: true })
    .order("nombre", { ascending: true })
    .limit(limite);

  // Falla en silencio a tabla vacía: esto pinta una tarjeta secundaria del
  // vestíbulo de /juegos. Si la migración 0029 todavía no se aplicó en este
  // entorno, la página debe seguir mostrando las puertas para entrar a jugar
  // en vez de reventar entera por un ranking que no se pudo leer.
  if (error) {
    console.error("[tabla-posiciones] no se pudo leer la vista:", error.message);
    return [];
  }

  return (data ?? []) as FilaPosicion[];
}
