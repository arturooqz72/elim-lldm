import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ALPHABET, VOWELS, TURN_SECONDS } from "@/lib/ruleta/wheel";
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
  if (!ALPHABET.includes(letra) || VOWELS.includes(letra)) {
    return NextResponse.json({ error: "Consonante inválida" }, { status: 400 });
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
  if (!sala.puede_consonante) {
    return NextResponse.json({ error: "No puedes adivinar una consonante ahora" }, { status: 400 });
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

  const { error: rondaUpdateError } = await service
    .from("ruleta_rondas")
    .update({ letras_adivinadas: nuevasLetras })
    .eq("id", ronda.id);

  if (rondaUpdateError) {
    return NextResponse.json({ error: rondaUpdateError.message }, { status: 500 });
  }

  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);

  if (count > 0) {
    const puntosGanados = count * (sala.valor_giro_actual ?? 0);

    const { data: jugador } = await service
      .from("ruleta_jugadores")
      .select("id, puntos")
      .eq("id", body.jugador_id)
      .single();

    if (jugador) {
      const { error: jugadorUpdateError } = await service
        .from("ruleta_jugadores")
        .update({ puntos: jugador.puntos + puntosGanados })
        .eq("id", jugador.id);
      if (jugadorUpdateError) {
        return NextResponse.json({ error: jugadorUpdateError.message }, { status: 500 });
      }
    }

    const resuelto = isPhraseSolved(ronda.frase, nuevasLetras);
    const endsAt = Date.now() + TURN_SECONDS * 1000;

    const { data: updated, error: updateError } = await service
      .from("ruleta_salas")
      .update(
        resuelto
          ? { status: "ronda_fin", puede_consonante: false, turno_termina_en: null }
          : { puede_consonante: false, turno_termina_en: new Date(endsAt).toISOString() }
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

    await channel.send({
      type: "broadcast",
      event: "LETTER_RESULT",
      payload: {
        letra,
        esVocal: false,
        acierto: true,
        apariciones: count,
        puntosGanados,
        board: buildBoardShape(ronda.frase, nuevasLetras),
        letrasProbadas: nuevasLetras,
        turnoJugadorId: body.jugador_id,
        turnoTerminaEn: resuelto ? null : endsAt,
        resuelto,
        frase: resuelto ? ronda.frase : undefined,
        jugadorGanadorId: resuelto ? body.jugador_id : undefined,
        mensaje: `La letra ${letra} aparece ${count} vez(es). +${puntosGanados} puntos.`,
      },
    });

    return NextResponse.json({ success: true });
  }

  // Letra incorrecta: pasa el turno
  const { data: jugadores } = await service
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", sala.id);

  const nextId = jugadores ? nextJugadorId(jugadores, body.jugador_id) : body.jugador_id;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

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
    event: "LETTER_RESULT",
    payload: {
      letra,
      esVocal: false,
      acierto: false,
      apariciones: 0,
      puntosGanados: 0,
      board: buildBoardShape(ronda.frase, nuevasLetras),
      letrasProbadas: nuevasLetras,
      turnoJugadorId: nextId,
      turnoTerminaEn: endsAt,
      resuelto: false,
      mensaje: `La letra ${letra} no está en la frase.`,
    },
  });

  return NextResponse.json({ success: true });
}
