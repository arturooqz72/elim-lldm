import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { prepararPreguntaDelBanco } from "@/lib/trivia/salas-banco.server";

const ROUND_SECONDS = 15;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = await createServiceClient();

  const { data: sala } = await service
    .from("elim_arena_salas")
    .select("*")
    .eq("codigo", codigo.toUpperCase())
    .single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const channel = supabase.channel(`arena:${codigo.toUpperCase()}`);
  const total = sala.total_preguntas as number;
  const nextOrden = sala.pregunta_actual + 1;

  async function terminar() {
    await service
      .from("elim_arena_salas")
      .update({ status: "finished" })
      .eq("id", sala.id);

    await channel.send({ type: "broadcast", event: "GAME_FINISHED", payload: {} });

    return NextResponse.json({ success: true, finished: true });
  }

  if (nextOrden > total) return terminar();

  // Modo banco: la siguiente sube de nivel si la mayoría acertó la
  // anterior, y nunca es una que alguno de los jugadores ya haya visto. Si
  // ya no queda ninguna, la partida termina aquí.
  const pregunta =
    sala.modo === "banco"
      ? await prepararPreguntaDelBanco("elim_arena", sala.id, nextOrden)
      : (
          await service
            .from("elim_arena_preguntas")
            .select("id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden")
            .eq("sala_id", sala.id)
            .eq("orden", nextOrden)
            .maybeSingle()
        ).data;

  if (!pregunta) return terminar();

  const endsAt = Date.now() + ROUND_SECONDS * 1000;

  await service
    .from("elim_arena_salas")
    .update({
      status: "playing",
      pregunta_actual: nextOrden,
      pregunta_termina_en: new Date(endsAt).toISOString(),
    })
    .eq("id", sala.id);

  await channel.send({
    type: "broadcast",
    event: "QUESTION_START",
    payload: {
      pregunta_id: pregunta.id,
      pregunta: pregunta.pregunta,
      opciones: {
        a: pregunta.opcion_a,
        b: pregunta.opcion_b,
        c: pregunta.opcion_c,
        d: pregunta.opcion_d,
      },
      orden: pregunta.orden,
      total,
      endsAt,
    },
  });

  return NextResponse.json({ success: true, finished: false });
}
