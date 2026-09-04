import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { VOWELS, VOWEL_COST, TURN_SECONDS, RONDA_FIN_SECONDS } from "@/lib/ruleta/wheel";
import { buildBoardShape, countLetterInPhrase, isPhraseSolved, nextJugadorId } from "@/lib/ruleta/game.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const service = await createServiceClient();

  let body: { jugador_id?: string; letra?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!body.jugador_id || !body.letra) {
    return NextResponse.json({ error: "jugador_id y letra requeridos" }, { status: 400 });
  }

  const letra = body.letra.toUpperCase();
  if (!VOWELS.includes(letra)) {
    return NextResponse.json({ error: "Vocal inválida" }, { status: 400 });
  }

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

  const { data: jugador } = await service
    .from("ruleta_jugadores")
    .select("id, puntos")
    .eq("id", body.jugador_id)
    .single();

  if (!jugador) return NextResponse.json({ error: "Jugador no encontrado" }, { status: 500 });
  if (jugador.puntos < VOWEL_COST) {
    return NextResponse.json({ error: "No tienes suficientes puntos" }, { status: 400 });
  }

  const { data: ronda } = await service
    .from("ruleta_rondas")
    .select("id, frase, letras_adivinadas")
    .eq("sala_id", sala.id)
    .eq("ronda_numero", sala.ronda_actual)
    .single();

  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 500 });

  const letrasAdivinadas = (ronda.letras_adivinadas as string[]) || [];
  if (letrasAdivinadas.includes(letra)) {
    return NextResponse.json({ error: "Ya intentaste esa letra" }, { status: 400 });
  }

  const count = countLetterInPhrase(ronda.frase, letra);
  const nuevasLetras = [...letrasAdivinadas, letra];
  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);

  if (count > 0) {
    // Vocal correcta
    const resuelto = isPhraseSolved(ronda.frase, nuevasLetras);
    const endsAt = Date.now() + TURN_SECONDS * 1000;
    const rondaFinTerminaEn = Date.now() + RONDA_FIN_SECONDS * 1000;

    // 1) Actualiza primero la sala (con guardia CAS) — nadie más puede tocar la
    // ronda/jugador hasta que ganemos esta carrera. No tocamos puede_consonante
    // ni giro_usado: una vocal no cambia si el jugador ya giró o ya usó su
    // consonante de este turno.
    const { data: updated, error: updateError } = await service
      .from("ruleta_salas")
      .update(
        resuelto
          ? {
              status: "ronda_fin",
              turno_termina_en: null,
              ronda_fin_termina_en: new Date(rondaFinTerminaEn).toISOString(),
            }
          : { turno_termina_en: new Date(endsAt).toISOString() }
      )
      .eq("id", sala.id)
      .eq("turno_termina_en", sala.turno_termina_en)
      .select("id");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "La sala cambió, intenta de nuevo" }, { status: 409 });
    }

    // 2) Solo ahora, habiendo ganado la carrera, tocamos jugador y ronda.
    // Releemos los puntos frescos (en vez de usar la lectura inicial) para no
    // pisar un cambio concurrente (p. ej. bancarrota en /spin) con un valor
    // obsoleto.
    const { data: jugadorFresco } = await service
      .from("ruleta_jugadores")
      .select("id, puntos")
      .eq("id", jugador.id)
      .single();

    if (!jugadorFresco) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 500 });
    }

    const { error: jugadorUpdateError } = await service
      .from("ruleta_jugadores")
      .update({ puntos: jugadorFresco.puntos - VOWEL_COST })
      .eq("id", jugadorFresco.id);

    if (jugadorUpdateError) {
      return NextResponse.json({ error: jugadorUpdateError.message }, { status: 500 });
    }

    const { error: rondaUpdateError } = await service
      .from("ruleta_rondas")
      .update({ letras_adivinadas: nuevasLetras })
      .eq("id", ronda.id);

    if (rondaUpdateError) {
      return NextResponse.json({ error: rondaUpdateError.message }, { status: 500 });
    }

    await channel.send({
      type: "broadcast",
      event: "LETTER_RESULT",
      payload: {
        letra,
        esVocal: true,
        acierto: true,
        apariciones: count,
        puntosGanados: 0,
        board: buildBoardShape(ronda.frase, nuevasLetras),
        letrasProbadas: nuevasLetras,
        turnoJugadorId: body.jugador_id,
        turnoTerminaEn: resuelto ? null : endsAt,
        resuelto,
        rondaFinTerminaEn: resuelto ? rondaFinTerminaEn : null,
        frase: resuelto ? ronda.frase : undefined,
        jugadorGanadorId: resuelto ? body.jugador_id : undefined,
        mensaje: `La vocal ${letra} aparece ${count} vez(es).`,
      },
    });

    return NextResponse.json({ success: true });
  }

  // Vocal incorrecta: pasa el turno
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

  // 2) Solo ahora, habiendo ganado la carrera, tocamos jugador y ronda.
  // Releemos los puntos frescos (en vez de usar la lectura inicial) para no
  // pisar un cambio concurrente (p. ej. bancarrota en /spin) con un valor
  // obsoleto.
  const { data: jugadorFresco } = await service
    .from("ruleta_jugadores")
    .select("id, puntos")
    .eq("id", jugador.id)
    .single();

  if (!jugadorFresco) {
    return NextResponse.json({ error: "Jugador no encontrado" }, { status: 500 });
  }

  const { error: jugadorUpdateError } = await service
    .from("ruleta_jugadores")
    .update({ puntos: jugadorFresco.puntos - VOWEL_COST })
    .eq("id", jugadorFresco.id);

  if (jugadorUpdateError) {
    return NextResponse.json({ error: jugadorUpdateError.message }, { status: 500 });
  }

  const { error: rondaUpdateError } = await service
    .from("ruleta_rondas")
    .update({ letras_adivinadas: nuevasLetras })
    .eq("id", ronda.id);

  if (rondaUpdateError) {
    return NextResponse.json({ error: rondaUpdateError.message }, { status: 500 });
  }

  await channel.send({
    type: "broadcast",
    event: "LETTER_RESULT",
    payload: {
      letra,
      esVocal: true,
      acierto: false,
      apariciones: 0,
      puntosGanados: 0,
      board: buildBoardShape(ronda.frase, nuevasLetras),
      letrasProbadas: nuevasLetras,
      turnoJugadorId: nextId,
      turnoTerminaEn: endsAt,
      resuelto: false,
      mensaje: `La vocal ${letra} no está en la frase.`,
    },
  });

  return NextResponse.json({ success: true });
}
