import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS, MIN_PLAYERS } from "@/lib/ruleta/wheel";
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
  if (sala.status !== "lobby") return NextResponse.json({ error: "El juego ya comenzó" }, { status: 400 });

  const { data: jugadores } = await supabase
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", sala.id)
    .order("orden");

  if (!jugadores || jugadores.length < MIN_PLAYERS) {
    return NextResponse.json({ error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` }, { status: 400 });
  }

  const { puzzle, usedKeys } = pickPuzzle(sala.frases_usadas as string[], sala.ultima_categoria);
  const frase = puzzle.phrase.toUpperCase();
  const primerJugador = jugadores[0];
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const service = await createServiceClient();

  const { error: rondaError } = await service.from("ruleta_rondas").upsert(
    {
      sala_id: sala.id,
      ronda_numero: 1,
      categoria: puzzle.category,
      frase,
      letras_adivinadas: [],
    },
    { onConflict: "sala_id,ronda_numero" }
  );
  if (rondaError) {
    return NextResponse.json({ error: rondaError.message }, { status: 500 });
  }

  const { error: salaUpdateError } = await service.from("ruleta_salas").update({
    status: "playing",
    ronda_actual: 1,
    turno_jugador_id: primerJugador.id,
    turno_termina_en: new Date(endsAt).toISOString(),
    giro_usado: false,
    puede_consonante: false,
    valor_giro_actual: null,
    frases_usadas: usedKeys,
    ultima_categoria: puzzle.category,
  }).eq("id", sala.id);

  if (salaUpdateError) {
    return NextResponse.json({ error: salaUpdateError.message }, { status: 500 });
  }

  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);
  await channel.send({
    type: "broadcast",
    event: "ROUND_START",
    payload: {
      ronda: 1,
      totalRondas: sala.rondas_totales,
      categoria: puzzle.category,
      board: buildBoardShape(frase, []),
      letrasProbadas: [],
      turnoJugadorId: primerJugador.id,
      turnoTerminaEn: endsAt,
    },
  });

  return NextResponse.json({ success: true });
}
