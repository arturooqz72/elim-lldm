import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  COUNTDOWN_SECONDS,
  ROUND_SECONDS,
  REVEAL_SECONDS,
  MIN_JUGADORES_PARA_INICIAR,
} from "@/lib/arena-publica/config";

async function broadcast(salaId: string, event: string, payload: object) {
  const supabase = await createClient();
  const channel = supabase.channel(`arena-publica:${salaId}`);
  await channel.httpSend(event, payload);
}

export async function POST(request: Request) {
  let body: { sala_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const salaId = body.sala_id;
  if (!salaId) {
    return NextResponse.json({ error: "sala_id es requerido" }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: sala, error: salaError } = await service
    .from("arena_publica_salas")
    .select("*")
    .eq("id", salaId)
    .maybeSingle();

  if (salaError) {
    return NextResponse.json({ error: salaError.message }, { status: 500 });
  }
  if (!sala) {
    return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  }

  const now = Date.now();

  // Transición 0: 'lobby' atascado con suficientes jugadores para arrancar.
  // Red de seguridad — normalmente es el propio join quien dispara el paso
  // a 'counting' al llegar a MIN_JUGADORES_PARA_INICIAR, pero si esa
  // actualización falla en silencio (error transitorio de DB sin retry), la
  // sala se queda en 'lobby' sin ningún deadline (cuenta_termina_en queda
  // null) y ningún cliente tendría forma de notar que "venció" algo. Como
  // /advance ya es el mecanismo de "cualquiera puede empujar" para el resto
  // de fases, también cubre este caso.
  if (sala.status === "lobby") {
    const { count, error: countError } = await service
      .from("arena_publica_jugadores")
      .select("id", { count: "exact", head: true })
      .eq("sala_id", salaId);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

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

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      if (updated && updated.length > 0) {
        await broadcast(salaId, "COUNTDOWN_START", { cuentaTerminaEn });
        return NextResponse.json({ applied: true });
      }
    }

    return NextResponse.json({ applied: false });
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

    if (preguntaError) {
      return NextResponse.json({ error: preguntaError.message }, { status: 500 });
    }
    if (!pregunta) {
      console.error(
        "[arena-publica/advance] Transición 1 (counting->playing): falta la pregunta con orden=1 — dato inconsistente",
        { salaId: sala.id, orden: 1 }
      );
      return NextResponse.json({ applied: false });
    }

    const { count: total, error: totalError } = await service
      .from("arena_publica_preguntas")
      .select("id", { count: "exact", head: true })
      .eq("sala_id", salaId);

    if (totalError) {
      return NextResponse.json({ error: totalError.message }, { status: 500 });
    }

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

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

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
      return NextResponse.json({ applied: true });
    }

    return NextResponse.json({ applied: false });
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

    if (preguntaError) {
      return NextResponse.json({ error: preguntaError.message }, { status: 500 });
    }
    if (!preguntaActual) {
      console.error(
        "[arena-publica/advance] Transición 2 (playing->reveal): falta la pregunta con orden=pregunta_actual — dato inconsistente",
        { salaId: sala.id, orden: sala.pregunta_actual }
      );
      return NextResponse.json({ applied: false });
    }

    // La respuesta correcta vive aparte, sin GRANTs públicos — solo el
    // service role client puede leerla. Ver 0021_arena_publica.sql.
    const { data: respuesta, error: respuestaError } = await service
      .from("arena_publica_respuestas_correctas")
      .select("respuesta_correcta")
      .eq("pregunta_id", preguntaActual.id)
      .maybeSingle();

    if (respuestaError) {
      return NextResponse.json({ error: respuestaError.message }, { status: 500 });
    }
    if (!respuesta) {
      console.error(
        "[arena-publica/advance] Transición 2 (playing->reveal): falta la respuesta correcta en arena_publica_respuestas_correctas — dato inconsistente",
        { salaId: sala.id, preguntaId: preguntaActual.id, orden: sala.pregunta_actual }
      );
      return NextResponse.json({ applied: false });
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

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (updated && updated.length > 0) {
      await broadcast(salaId, "REVEAL_START", {
        pregunta_id: preguntaActual.id,
        respuesta_correcta: respuesta.respuesta_correcta,
        revealTerminaEn,
      });
      return NextResponse.json({ applied: true });
    }

    return NextResponse.json({ applied: false });
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

    if (totalError) {
      return NextResponse.json({ error: totalError.message }, { status: 500 });
    }

    const siguienteOrden = sala.pregunta_actual + 1;

    if (siguienteOrden > (total ?? 0)) {
      const { data: updated, error: updateError } = await service
        .from("arena_publica_salas")
        .update({ status: "finished" })
        .eq("id", salaId)
        .eq("status", "reveal")
        .eq("reveal_termina_en", sala.reveal_termina_en)
        .select("id");

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      if (updated && updated.length > 0) {
        await broadcast(salaId, "GAME_FINISHED", {});
        return NextResponse.json({ applied: true });
      }

      return NextResponse.json({ applied: false });
    }

    const { data: pregunta, error: preguntaError } = await service
      .from("arena_publica_preguntas")
      .select("id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden")
      .eq("sala_id", salaId)
      .eq("orden", siguienteOrden)
      .maybeSingle();

    if (preguntaError) {
      return NextResponse.json({ error: preguntaError.message }, { status: 500 });
    }
    if (!pregunta) {
      console.error(
        "[arena-publica/advance] Transición 3 (reveal->siguiente pregunta): falta la pregunta con orden=siguienteOrden — dato inconsistente",
        { salaId: sala.id, orden: siguienteOrden }
      );
      return NextResponse.json({ applied: false });
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

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

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
      return NextResponse.json({ applied: true });
    }

    return NextResponse.json({ applied: false });
  }

  return NextResponse.json({ applied: false });
}
