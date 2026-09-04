import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { WHEEL_SEGMENTS, TURN_SECONDS, pickWheelSegmentIndex } from "@/lib/ruleta/wheel";
import { nextJugadorId } from "@/lib/ruleta/game.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const service = await createServiceClient();

  let body: { jugador_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!body.jugador_id) return NextResponse.json({ error: "jugador_id requerido" }, { status: 400 });

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("codigo", codigo.toUpperCase())
    .single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "playing") return NextResponse.json({ error: "No se puede girar ahora" }, { status: 400 });
  if (sala.turno_jugador_id !== body.jugador_id) {
    return NextResponse.json({ error: "No es tu turno" }, { status: 403 });
  }
  if (sala.giro_usado) return NextResponse.json({ error: "Ya giraste en este turno" }, { status: 400 });

  const { data: jugadores } = await service
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", sala.id);

  const segmentIndex = pickWheelSegmentIndex();
  const seg = WHEEL_SEGMENTS[segmentIndex];
  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);

  if (seg.type === "puntos") {
    const endsAt = Date.now() + TURN_SECONDS * 1000;
    const { data: updated, error: updateError } = await service
      .from("ruleta_salas")
      .update({
        giro_usado: true,
        puede_consonante: true,
        valor_giro_actual: seg.value,
        turno_termina_en: new Date(endsAt).toISOString(),
        turnos_saltados_seguidos: 0,
      })
      .eq("id", sala.id)
      .eq("giro_usado", false)
      .eq("turno_jugador_id", body.jugador_id)
      .select("id");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Ya giraste en este turno" }, { status: 409 });
    }

    await channel.send({
      type: "broadcast",
      event: "SPIN_RESULT",
      payload: {
        segmentIndex,
        tipo: "puntos",
        valor: seg.value,
        turnoJugadorId: body.jugador_id,
        turnoTerminaEn: endsAt,
        mensaje: `Elige una consonante (${seg.value} pts c/u).`,
      },
    });
    return NextResponse.json({ success: true });
  }

  // bancarrota o pierde_turno: se resuelve de inmediato y pasa el turno
  if (seg.type === "bancarrota" && jugadores) {
    const jugador = jugadores.find((j) => j.id === body.jugador_id);
    if (jugador) {
      const { error: jugadorUpdateError } = await service
        .from("ruleta_jugadores")
        .update({ puntos: 0 })
        .eq("id", jugador.id);
      if (jugadorUpdateError) {
        return NextResponse.json({ error: jugadorUpdateError.message }, { status: 500 });
      }
    }
  }

  const nextId = jugadores ? nextJugadorId(jugadores, body.jugador_id) : body.jugador_id;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { data: updated, error: updateError } = await service
    .from("ruleta_salas")
    .update({
      giro_usado: false,
      puede_consonante: false,
      valor_giro_actual: null,
      turno_jugador_id: nextId,
      turno_termina_en: new Date(endsAt).toISOString(),
      turnos_saltados_seguidos: 0,
    })
    .eq("id", sala.id)
    .eq("giro_usado", false)
    .eq("turno_jugador_id", body.jugador_id)
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "Ya giraste en este turno" }, { status: 409 });
  }

  await channel.send({
    type: "broadcast",
    event: "SPIN_RESULT",
    payload: {
      segmentIndex,
      tipo: seg.type,
      turnoJugadorId: nextId,
      turnoTerminaEn: endsAt,
      mensaje: seg.type === "bancarrota" ? "¡BANCARROTA! Pierde todos sus puntos." : "¡Pierde turno!",
    },
  });

  return NextResponse.json({ success: true });
}
