import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS, RESOLVE_BONUS, RONDA_FIN_SECONDS } from "@/lib/ruleta/wheel";
import { buildBoardShape, allLettersInPhrase, nextJugadorId, normalize } from "@/lib/ruleta/game.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const service = await createServiceClient();

  let body: { jugador_id?: string; respuesta?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!body.jugador_id || !body.respuesta) {
    return NextResponse.json({ error: "jugador_id y respuesta requeridos" }, { status: 400 });
  }
  if (typeof body.respuesta !== "string" || body.respuesta.trim().length === 0) {
    return NextResponse.json({ error: "Respuesta inválida" }, { status: 400 });
  }

  const respuesta = body.respuesta.trim().replace(/\s+/g, " ");

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("codigo", codigo.toUpperCase())
    .single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "playing") return NextResponse.json({ error: "No se puede jugar ahora" }, { status: 400 });
  if (sala.turno_jugador_id !== body.jugador_id) {
    return NextResponse.json({ error: "No es tu turno" }, { status: 403 });
  }

  const { data: ronda } = await service
    .from("ruleta_rondas")
    .select("id, frase")
    .eq("sala_id", sala.id)
    .eq("ronda_numero", sala.ronda_actual)
    .single();

  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 500 });

  const acierto = normalize(respuesta) === ronda.frase;
  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);

  if (acierto) {
    // Resolvió el panel correctamente
    const todasLasLetras = allLettersInPhrase(ronda.frase);

    // 1) Actualiza primero la sala (con guardia CAS) — nadie más puede tocar la
    // ronda/jugador hasta que ganemos esta carrera.
    const ronda_fin_termina_en = Date.now() + RONDA_FIN_SECONDS * 1000;
    const { data: updated, error: updateError } = await service
      .from("ruleta_salas")
      .update({
        status: "ronda_fin",
        turno_termina_en: null,
        ronda_fin_termina_en: new Date(ronda_fin_termina_en).toISOString(),
      })
      .eq("id", sala.id)
      .eq("turno_termina_en", sala.turno_termina_en)
      .select("id");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "La sala cambió, intenta de nuevo" }, { status: 409 });
    }

    // 2) Solo ahora, habiendo ganado la carrera, tocamos ronda y jugador.
    const { error: rondaUpdateError } = await service
      .from("ruleta_rondas")
      .update({ letras_adivinadas: todasLasLetras })
      .eq("id", ronda.id);

    if (rondaUpdateError) {
      return NextResponse.json({ error: rondaUpdateError.message }, { status: 500 });
    }

    // Releemos los puntos frescos (en vez de usar una lectura inicial) para no
    // pisar un cambio concurrente con un valor obsoleto.
    const { data: jugadorFresco } = await service
      .from("ruleta_jugadores")
      .select("id, puntos")
      .eq("id", body.jugador_id)
      .single();

    if (!jugadorFresco) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 500 });
    }

    const { error: jugadorUpdateError } = await service
      .from("ruleta_jugadores")
      .update({ puntos: jugadorFresco.puntos + RESOLVE_BONUS })
      .eq("id", jugadorFresco.id);

    if (jugadorUpdateError) {
      return NextResponse.json({ error: jugadorUpdateError.message }, { status: 500 });
    }

    await channel.send({
      type: "broadcast",
      event: "RESOLVE_RESULT",
      payload: {
        acierto: true,
        frase: ronda.frase,
        board: buildBoardShape(ronda.frase, todasLasLetras),
        letrasProbadas: todasLasLetras,
        turnoJugadorId: body.jugador_id,
        turnoTerminaEn: null,
        resuelto: true,
        jugadorGanadorId: body.jugador_id,
        puntosGanados: RESOLVE_BONUS,
        mensaje: "¡Resolvió el panel!",
      },
    });

    return NextResponse.json({ success: true });
  }

  // Respuesta incorrecta: pasa el turno (sin penalización de puntos)
  const { data: jugadores } = await service
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", sala.id);

  const nextId = jugadores ? nextJugadorId(jugadores, body.jugador_id) : body.jugador_id;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  // 1) Actualiza primero la sala (con guardia CAS). El turno pasa a otro
  // jugador, así que sí reiniciamos puede_consonante/giro_usado.
  const { data: updated, error: updateError } = await service
    .from("ruleta_salas")
    .update({
      puede_consonante: false,
      giro_usado: false,
      turno_jugador_id: nextId,
      turno_termina_en: new Date(endsAt).toISOString(),
    })
    .eq("id", sala.id)
    .eq("turno_termina_en", sala.turno_termina_en)
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "La sala cambió, intenta de nuevo" }, { status: 409 });
  }

  await channel.send({
    type: "broadcast",
    event: "RESOLVE_RESULT",
    payload: {
      acierto: false,
      turnoJugadorId: nextId,
      turnoTerminaEn: endsAt,
      resuelto: false,
      mensaje: "Respuesta incorrecta.",
    },
  });

  return NextResponse.json({ success: true });
}
