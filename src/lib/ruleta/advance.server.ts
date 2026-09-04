// src/lib/ruleta/advance.server.ts
import "server-only";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS, MIN_PLAYERS } from "./wheel";
import { buildBoardShape } from "./game.server";
import { pickPuzzle } from "./puzzles.server";
import { nextJugadorId } from "./game.server";

async function broadcast(codigo: string, event: string, payload: object) {
  const supabase = await createClient();
  const channel = supabase.channel(`ruleta:${codigo}`);
  await channel.send({ type: "broadcast", event, payload });
}

/**
 * Intenta pasar la sala de 'lobby' a 'playing' — arranca la primera ronda.
 * Misma lógica que tenía start/route.ts, ahora reutilizable desde: la
 * propia ruta /start (llamada por cualquier jugador, no solo un
 * "anfitrión"), la auto-sanación de una sala 'lobby' atascada, y
 * /force-start (que pasa requireTarget=false para saltarse la meta y
 * arrancar con el piso mínimo).
 */
export async function tryStartMatch(
  salaId: string,
  requireTarget: boolean
): Promise<{ applied: boolean; error?: string }> {
  const service = await createServiceClient();

  const { data: sala, error: salaError } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("id", salaId)
    .maybeSingle();

  if (salaError) return { applied: false, error: salaError.message };
  if (!sala || sala.status !== "lobby") return { applied: false };

  const { data: jugadores, error: jugadoresError } = await service
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", salaId)
    .order("orden");

  if (jugadoresError) return { applied: false, error: jugadoresError.message };

  const umbral = requireTarget ? sala.jugadores_deseados : MIN_PLAYERS;
  if (!jugadores || jugadores.length < umbral) return { applied: false };

  const { puzzle, usedKeys } = pickPuzzle(sala.frases_usadas as string[], sala.ultima_categoria);
  const frase = puzzle.phrase.toUpperCase();
  const primerJugador = jugadores[0];
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { data: updated, error: updateError } = await service
    .from("ruleta_salas")
    .update({
      status: "playing",
      ronda_actual: 1,
      turno_jugador_id: primerJugador.id,
      turno_termina_en: new Date(endsAt).toISOString(),
      giro_usado: false,
      puede_consonante: false,
      valor_giro_actual: null,
      frases_usadas: usedKeys,
      ultima_categoria: puzzle.category,
    })
    .eq("id", salaId)
    .eq("status", "lobby")
    .select("id");

  if (updateError) return { applied: false, error: updateError.message };
  if (!updated || updated.length === 0) return { applied: false };

  const { error: rondaError } = await service.from("ruleta_rondas").upsert(
    { sala_id: salaId, ronda_numero: 1, categoria: puzzle.category, frase, letras_adivinadas: [] },
    { onConflict: "sala_id,ronda_numero" }
  );
  if (rondaError) return { applied: false, error: rondaError.message };

  await broadcast(sala.codigo, "ROUND_START", {
    ronda: 1,
    totalRondas: sala.rondas_totales,
    categoria: puzzle.category,
    board: buildBoardShape(frase, []),
    letrasProbadas: [],
    turnoJugadorId: primerJugador.id,
    turnoTerminaEn: endsAt,
  });

  return { applied: true };
}

/**
 * Intenta avanzar el turno cuando venció (o, con bypassDeadline=true, sin
 * esperar a que venza) — mismo comportamiento que tenía timeout/route.ts.
 * bypassDeadline reemplaza al viejo "force" exclusivo del anfitrión: ahora
 * lo puede pedir cualquier jugador de la sala (ver /timeout, que valida
 * pertenencia antes de pasar bypassDeadline=true) o la auto-sanación.
 */
export async function tryAdvanceTurn(
  salaId: string,
  bypassDeadline: boolean
): Promise<{ applied: boolean; error?: string }> {
  const service = await createServiceClient();

  const { data: sala, error: salaError } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("id", salaId)
    .maybeSingle();

  if (salaError) return { applied: false, error: salaError.message };
  if (!sala || sala.status !== "playing" || sala.turno_termina_en === null) {
    return { applied: false };
  }
  if (!bypassDeadline && new Date(sala.turno_termina_en).getTime() > Date.now()) {
    return { applied: false };
  }
  if (sala.turno_jugador_id === null) return { applied: false };

  const { data: jugadores, error: jugadoresError } = await service
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", salaId);

  if (jugadoresError) return { applied: false, error: jugadoresError.message };
  if (!jugadores || jugadores.length === 0) return { applied: false };

  const nextId = nextJugadorId(jugadores, sala.turno_jugador_id);
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { data: updated, error: updateError } = await service
    .from("ruleta_salas")
    .update({
      puede_consonante: false,
      giro_usado: false,
      turno_jugador_id: nextId,
      turno_termina_en: new Date(endsAt).toISOString(),
    })
    .eq("id", salaId)
    .eq("turno_termina_en", sala.turno_termina_en)
    .select("id");

  if (updateError) return { applied: false, error: updateError.message };
  if (!updated || updated.length === 0) return { applied: false };

  await broadcast(sala.codigo, "TURN_TIMEOUT", {
    turnoJugadorId: nextId,
    turnoTerminaEn: endsAt,
    mensaje: "Se acabó el tiempo.",
  });

  return { applied: true };
}

/**
 * Intenta pasar la sala de 'ronda_fin' a la siguiente ronda (o a
 * 'finished' si ya no quedan más) — mismo comportamiento que tenía
 * next-round/route.ts, ahora auto-disparable: solo aplica una vez que
 * ronda_fin_termina_en ya venció (a diferencia del viejo botón manual del
 * anfitrión, que no esperaba nada).
 */
export async function tryAdvanceRound(salaId: string): Promise<{ applied: boolean; error?: string }> {
  const service = await createServiceClient();

  const { data: sala, error: salaError } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("id", salaId)
    .maybeSingle();

  if (salaError) return { applied: false, error: salaError.message };
  if (
    !sala ||
    sala.status !== "ronda_fin" ||
    !sala.ronda_fin_termina_en ||
    new Date(sala.ronda_fin_termina_en).getTime() > Date.now()
  ) {
    return { applied: false };
  }

  if (sala.ronda_actual >= sala.rondas_totales) {
    const { data: updated, error: updateError } = await service
      .from("ruleta_salas")
      .update({ status: "finished" })
      .eq("id", salaId)
      .eq("status", "ronda_fin")
      .eq("ronda_fin_termina_en", sala.ronda_fin_termina_en)
      .select("id");

    if (updateError) return { applied: false, error: updateError.message };
    if (!updated || updated.length === 0) return { applied: false };

    await broadcast(sala.codigo, "GAME_FINISHED", {});
    return { applied: true };
  }

  const { puzzle, usedKeys } = pickPuzzle(sala.frases_usadas as string[], sala.ultima_categoria);
  const frase = puzzle.phrase.toUpperCase();
  const nuevaRonda = sala.ronda_actual + 1;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { data: updated, error: updateError } = await service
    .from("ruleta_salas")
    .update({
      status: "playing",
      ronda_actual: nuevaRonda,
      turno_termina_en: new Date(endsAt).toISOString(),
      ronda_fin_termina_en: null,
      giro_usado: false,
      puede_consonante: false,
      valor_giro_actual: null,
      frases_usadas: usedKeys,
      ultima_categoria: puzzle.category,
    })
    .eq("id", salaId)
    .eq("status", "ronda_fin")
    .eq("ronda_fin_termina_en", sala.ronda_fin_termina_en)
    .select("id");

  if (updateError) return { applied: false, error: updateError.message };
  if (!updated || updated.length === 0) return { applied: false };

  const { error: rondaError } = await service.from("ruleta_rondas").upsert(
    { sala_id: salaId, ronda_numero: nuevaRonda, categoria: puzzle.category, frase, letras_adivinadas: [] },
    { onConflict: "sala_id,ronda_numero" }
  );
  if (rondaError) return { applied: false, error: rondaError.message };

  await broadcast(sala.codigo, "ROUND_START", {
    ronda: nuevaRonda,
    totalRondas: sala.rondas_totales,
    categoria: puzzle.category,
    board: buildBoardShape(frase, []),
    letrasProbadas: [],
    turnoJugadorId: sala.turno_jugador_id,
    turnoTerminaEn: endsAt,
  });

  return { applied: true };
}

// Cuánto tiempo, más allá del deadline, se espera antes de considerar una
// sala "abandonada" y sanarla sin que haya cliente conectado — suficiente
// margen para que el cliente legítimo (el que perdió la carrera) dispare su
// propia petición por la vía normal antes de que esto interfiera.
const STALE_GRACE_MS = 15_000;

/**
 * Red de seguridad para salas abandonadas — mismo espíritu que
 * healStaleRooms() de Arena Abierta. Se llama desde
 * getOrCreateOpenRoom() en cada visita a /ruleta:
 *  - 'lobby' con suficientes jugadores pero que nunca arrancó (el propio
 *    /join falló en silencio al intentarlo) → tryStartMatch.
 *  - 'playing' cuyo turno venció hace rato y nadie lo reportó (todos
 *    cerraron la pestaña) → tryAdvanceTurn con bypassDeadline.
 *  - 'ronda_fin' cuyo ronda_fin_termina_en venció hace rato → tryAdvanceRound.
 */
export async function healStaleRuletaRooms(): Promise<void> {
  const service = await createServiceClient();
  const now = Date.now();

  const { data: salas, error } = await service
    .from("ruleta_salas")
    .select("id, status, turno_termina_en, ronda_fin_termina_en")
    .in("status", ["lobby", "playing", "ronda_fin"]);

  if (error) {
    console.error("[ruleta/heal] Error al buscar salas activas:", error);
    return;
  }
  if (!salas || salas.length === 0) return;

  for (const sala of salas) {
    try {
      if (sala.status === "lobby") {
        const { error: startError } = await tryStartMatch(sala.id, true);
        if (startError) console.error(`[ruleta/heal] Error al intentar arrancar sala ${sala.id}:`, startError);
        continue;
      }

      if (sala.status === "playing") {
        if (!sala.turno_termina_en) continue;
        if (now - new Date(sala.turno_termina_en).getTime() < STALE_GRACE_MS) continue;
        const { error: turnoError } = await tryAdvanceTurn(sala.id, true);
        if (turnoError) console.error(`[ruleta/heal] Error al sanar turno de sala ${sala.id}:`, turnoError);
        continue;
      }

      if (sala.status === "ronda_fin") {
        if (!sala.ronda_fin_termina_en) continue;
        if (now - new Date(sala.ronda_fin_termina_en).getTime() < STALE_GRACE_MS) continue;
        const { error: rondaError } = await tryAdvanceRound(sala.id);
        if (rondaError) console.error(`[ruleta/heal] Error al sanar ronda de sala ${sala.id}:`, rondaError);
      }
    } catch (err) {
      console.error(`[ruleta/heal] Excepción inesperada al sanar sala ${sala.id}:`, err);
    }
  }
}
