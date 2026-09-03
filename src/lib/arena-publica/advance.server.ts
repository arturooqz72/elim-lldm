// src/lib/arena-publica/advance.server.ts
import "server-only";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  COUNTDOWN_SECONDS,
  ROUND_SECONDS,
  REVEAL_SECONDS,
  MIN_JUGADORES_PARA_INICIAR,
} from "./config";

async function broadcast(salaId: string, event: string, payload: object) {
  const supabase = await createClient();
  const channel = supabase.channel(`arena-publica:${salaId}`);
  await channel.httpSend(event, payload);
}

/**
 * Aplica como máximo UNA transición de fase para la sala dada, si su
 * deadline actual ya venció. La usan tanto el endpoint /advance (que
 * cualquier cliente conectado dispara al vencer su CountdownCircle local)
 * como healStaleRooms() (que la dispara sin que haya ningún cliente
 * conectado). Misma lógica, dos disparadores distintos.
 */
export async function advanceRoomOnce(
  salaId: string
): Promise<{ applied: boolean; error?: string }> {
  const service = await createServiceClient();

  const { data: sala, error: salaError } = await service
    .from("arena_publica_salas")
    .select("*")
    .eq("id", salaId)
    .maybeSingle();

  if (salaError) return { applied: false, error: salaError.message };
  if (!sala) return { applied: false, error: "Sala no encontrada" };

  const now = Date.now();

  // Transición 0: 'lobby' atascado con suficientes jugadores para arrancar.
  // Red de seguridad — normalmente es el propio join quien dispara el paso
  // a 'counting' al llegar a MIN_JUGADORES_PARA_INICIAR, pero si esa
  // actualización falla en silencio (error transitorio de DB sin retry), la
  // sala se queda en 'lobby' sin ningún deadline (cuenta_termina_en queda
  // null) y ningún cliente tendría forma de notar que "venció" algo.
  if (sala.status === "lobby") {
    const { count, error: countError } = await service
      .from("arena_publica_jugadores")
      .select("id", { count: "exact", head: true })
      .eq("sala_id", salaId);

    if (countError) return { applied: false, error: countError.message };

    if ((count ?? 0) >= MIN_JUGADORES_PARA_INICIAR) {
      const cuentaTerminaEn = now + COUNTDOWN_SECONDS * 1000;
      const { data: updated, error: updateError } = await service
        .from("arena_publica_salas")
        .update({
          status: "counting",
          cuenta_termina_en: new Date(cuentaTerminaEn).toISOString(),
        })
        .eq("id", salaId)
        .eq("status", "lobby")
        .select("id");

      if (updateError) return { applied: false, error: updateError.message };

      if (updated && updated.length > 0) {
        await broadcast(salaId, "COUNTDOWN_START", { cuentaTerminaEn });
        return { applied: true };
      }
    }

    return { applied: false };
  }

  // Transición 1: 'counting' -> 'playing' (primera pregunta).
  else if (
    sala.status === "counting" &&
    sala.cuenta_termina_en &&
    new Date(sala.cuenta_termina_en).getTime() <= now
  ) {
    const { data: pregunta, error: preguntaError } = await service
      .from("arena_publica_preguntas")
      .select("id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden")
      .eq("sala_id", salaId)
      .eq("orden", 1)
      .maybeSingle();

    if (preguntaError) return { applied: false, error: preguntaError.message };
    if (!pregunta) {
      console.error(
        "[arena-publica/advance] Transición 1 (counting->playing): falta la pregunta con orden=1 — dato inconsistente",
        { salaId: sala.id, orden: 1 }
      );
      return { applied: false };
    }

    const { count: total, error: totalError } = await service
      .from("arena_publica_preguntas")
      .select("id", { count: "exact", head: true })
      .eq("sala_id", salaId);

    if (totalError) return { applied: false, error: totalError.message };

    const endsAt = now + ROUND_SECONDS * 1000;
    const { data: updated, error: updateError } = await service
      .from("arena_publica_salas")
      .update({
        status: "playing",
        pregunta_actual: 1,
        pregunta_termina_en: new Date(endsAt).toISOString(),
      })
      .eq("id", salaId)
      .eq("status", "counting")
      .eq("cuenta_termina_en", sala.cuenta_termina_en)
      .select("id");

    if (updateError) return { applied: false, error: updateError.message };

    if (updated && updated.length > 0) {
      await broadcast(salaId, "QUESTION_START", {
        pregunta_id: pregunta.id,
        pregunta: pregunta.pregunta,
        opciones: {
          a: pregunta.opcion_a,
          b: pregunta.opcion_b,
          c: pregunta.opcion_c,
          d: pregunta.opcion_d,
        },
        orden: pregunta.orden,
        total: total ?? 0,
        endsAt,
      });
      return { applied: true };
    }

    return { applied: false };
  }

  // Transición 2: 'playing' -> 'reveal'.
  else if (
    sala.status === "playing" &&
    sala.pregunta_termina_en &&
    new Date(sala.pregunta_termina_en).getTime() <= now
  ) {
    const { data: preguntaActual, error: preguntaError } = await service
      .from("arena_publica_preguntas")
      .select("id")
      .eq("sala_id", salaId)
      .eq("orden", sala.pregunta_actual)
      .maybeSingle();

    if (preguntaError) return { applied: false, error: preguntaError.message };
    if (!preguntaActual) {
      console.error(
        "[arena-publica/advance] Transición 2 (playing->reveal): falta la pregunta con orden=pregunta_actual — dato inconsistente",
        { salaId: sala.id, orden: sala.pregunta_actual }
      );
      return { applied: false };
    }

    // La respuesta correcta vive aparte, sin GRANTs públicos — solo el
    // service role client puede leerla. Ver 0021_arena_publica.sql.
    const { data: respuesta, error: respuestaError } = await service
      .from("arena_publica_respuestas_correctas")
      .select("respuesta_correcta")
      .eq("pregunta_id", preguntaActual.id)
      .maybeSingle();

    if (respuestaError) return { applied: false, error: respuestaError.message };
    if (!respuesta) {
      console.error(
        "[arena-publica/advance] Transición 2 (playing->reveal): falta la respuesta correcta en arena_publica_respuestas_correctas — dato inconsistente",
        { salaId: sala.id, preguntaId: preguntaActual.id, orden: sala.pregunta_actual }
      );
      return { applied: false };
    }

    const revealTerminaEn = now + REVEAL_SECONDS * 1000;
    const { data: updated, error: updateError } = await service
      .from("arena_publica_salas")
      .update({
        status: "reveal",
        reveal_termina_en: new Date(revealTerminaEn).toISOString(),
      })
      .eq("id", salaId)
      .eq("status", "playing")
      .eq("pregunta_termina_en", sala.pregunta_termina_en)
      .select("id");

    if (updateError) return { applied: false, error: updateError.message };

    if (updated && updated.length > 0) {
      await broadcast(salaId, "REVEAL_START", {
        pregunta_id: preguntaActual.id,
        respuesta_correcta: respuesta.respuesta_correcta,
        revealTerminaEn,
      });
      return { applied: true };
    }

    return { applied: false };
  }

  // Transición 3: 'reveal' -> siguiente pregunta, o 'finished' si ya no
  // quedan más.
  else if (
    sala.status === "reveal" &&
    sala.reveal_termina_en &&
    new Date(sala.reveal_termina_en).getTime() <= now
  ) {
    const { count: total, error: totalError } = await service
      .from("arena_publica_preguntas")
      .select("id", { count: "exact", head: true })
      .eq("sala_id", salaId);

    if (totalError) return { applied: false, error: totalError.message };

    const siguienteOrden = sala.pregunta_actual + 1;

    if (siguienteOrden > (total ?? 0)) {
      const { data: updated, error: updateError } = await service
        .from("arena_publica_salas")
        .update({ status: "finished" })
        .eq("id", salaId)
        .eq("status", "reveal")
        .eq("reveal_termina_en", sala.reveal_termina_en)
        .select("id");

      if (updateError) return { applied: false, error: updateError.message };

      if (updated && updated.length > 0) {
        await broadcast(salaId, "GAME_FINISHED", {});
        return { applied: true };
      }

      return { applied: false };
    }

    const { data: pregunta, error: preguntaError } = await service
      .from("arena_publica_preguntas")
      .select("id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden")
      .eq("sala_id", salaId)
      .eq("orden", siguienteOrden)
      .maybeSingle();

    if (preguntaError) return { applied: false, error: preguntaError.message };
    if (!pregunta) {
      console.error(
        "[arena-publica/advance] Transición 3 (reveal->siguiente pregunta): falta la pregunta con orden=siguienteOrden — dato inconsistente",
        { salaId: sala.id, orden: siguienteOrden }
      );
      return { applied: false };
    }

    const endsAt = now + ROUND_SECONDS * 1000;
    const { data: updated, error: updateError } = await service
      .from("arena_publica_salas")
      .update({
        status: "playing",
        pregunta_actual: siguienteOrden,
        pregunta_termina_en: new Date(endsAt).toISOString(),
      })
      .eq("id", salaId)
      .eq("status", "reveal")
      .eq("reveal_termina_en", sala.reveal_termina_en)
      .select("id");

    if (updateError) return { applied: false, error: updateError.message };

    if (updated && updated.length > 0) {
      await broadcast(salaId, "QUESTION_START", {
        pregunta_id: pregunta.id,
        pregunta: pregunta.pregunta,
        opciones: {
          a: pregunta.opcion_a,
          b: pregunta.opcion_b,
          c: pregunta.opcion_c,
          d: pregunta.opcion_d,
        },
        orden: pregunta.orden,
        total: total ?? 0,
        endsAt,
      });
      return { applied: true };
    }

    return { applied: false };
  }

  return { applied: false };
}

// Cuánto tiempo, más allá del deadline, se espera antes de considerar una
// sala "abandonada" y sanarla sin que haya cliente conectado — suficiente
// margen para que el cliente legítimo (el que perdió la carrera) dispare su
// propio /advance por la vía normal antes de que esto interfiera.
const STALE_GRACE_MS = 15_000;

/**
 * Red de seguridad para salas 'counting' | 'playing' | 'reveal' cuyo
 * deadline ya venció hace rato y que nadie ha hecho avanzar — esto pasa
 * cuando todos los jugadores conectados cierran la pestaña a mitad de
 * partida, porque el avance de fase depende de que algún cliente con timer
 * vivo llame a /advance. Se llama desde getOrCreateOpenRoom() en cada visita
 * a la página, así que cualquier visitante (entre a la sala que entre) va
 * sanando de paso las demás salas abandonadas, un paso de fase a la vez —
 * cada avance aplicado deja un deadline nuevo en el futuro, así que esta
 * función nunca hace más de una transición por sala por llamada.
 */
export async function healStaleRooms(): Promise<void> {
  const service = await createServiceClient();

  const { data: salas, error } = await service
    .from("arena_publica_salas")
    .select("id, status, cuenta_termina_en, pregunta_termina_en, reveal_termina_en")
    .in("status", ["counting", "playing", "reveal"]);

  if (error) {
    console.error("[arena-publica/heal] Error al buscar salas activas:", error);
    return;
  }
  if (!salas || salas.length === 0) return;

  const now = Date.now();

  for (const sala of salas) {
    const deadline =
      sala.status === "counting"
        ? sala.cuenta_termina_en
        : sala.status === "playing"
          ? sala.pregunta_termina_en
          : sala.reveal_termina_en;

    if (!deadline) continue;
    if (now - new Date(deadline).getTime() < STALE_GRACE_MS) continue;

    const { error: advanceError } = await advanceRoomOnce(sala.id);
    if (advanceError) {
      console.error(`[arena-publica/heal] Error al sanar sala ${sala.id}:`, advanceError);
    }
  }
}
