import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS } from "@/lib/ruleta/wheel";
import { buildBoardShape } from "@/lib/ruleta/game.server";
import { pickPuzzle } from "@/lib/ruleta/puzzles.server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sala } = await supabase
    .from("ruleta_salas")
    .select("*")
    .eq("codigo", codigo.toUpperCase())
    .single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (sala.status !== "ronda_fin") {
    return NextResponse.json({ error: "La ronda actual no ha terminado" }, { status: 400 });
  }

  const service = await createServiceClient();
  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);

  if (sala.ronda_actual >= sala.rondas_totales) {
    const { error: salaUpdateError } = await service
      .from("ruleta_salas")
      .update({ status: "finished" })
      .eq("id", sala.id);

    if (salaUpdateError) {
      return NextResponse.json({ error: salaUpdateError.message }, { status: 500 });
    }

    await channel.send({
      type: "broadcast",
      event: "GAME_FINISHED",
      payload: {},
    });

    return NextResponse.json({ success: true, finished: true });
  }

  const { puzzle, usedKeys } = pickPuzzle(sala.frases_usadas as string[], sala.ultima_categoria);
  const frase = puzzle.phrase.toUpperCase();
  const nuevaRonda = sala.ronda_actual + 1;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { data: updated, error: salaUpdateError } = await service
    .from("ruleta_salas")
    .update({
      status: "playing",
      ronda_actual: nuevaRonda,
      turno_termina_en: new Date(endsAt).toISOString(),
      giro_usado: false,
      puede_consonante: false,
      valor_giro_actual: null,
      frases_usadas: usedKeys,
      ultima_categoria: puzzle.category,
    })
    .eq("id", sala.id)
    .eq("status", "ronda_fin")
    .eq("ronda_actual", sala.ronda_actual)
    .select("id");

  if (salaUpdateError) {
    return NextResponse.json({ error: salaUpdateError.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "La ronda ya fue avanzada" }, { status: 409 });
  }

  const { error: rondaError } = await service.from("ruleta_rondas").upsert(
    {
      sala_id: sala.id,
      ronda_numero: nuevaRonda,
      categoria: puzzle.category,
      frase,
      letras_adivinadas: [],
    },
    { onConflict: "sala_id,ronda_numero" }
  );
  if (rondaError) {
    return NextResponse.json({ error: rondaError.message }, { status: 500 });
  }

  await channel.send({
    type: "broadcast",
    event: "ROUND_START",
    payload: {
      ronda: nuevaRonda,
      totalRondas: sala.rondas_totales,
      categoria: puzzle.category,
      board: buildBoardShape(frase, []),
      letrasProbadas: [],
      turnoJugadorId: sala.turno_jugador_id,
      turnoTerminaEn: endsAt,
    },
  });

  return NextResponse.json({ success: true, finished: false });
}
