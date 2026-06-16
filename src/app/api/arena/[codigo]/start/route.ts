import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const ROUND_SECONDS = 15;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sala } = await supabase
    .from("elim_arena_salas")
    .select("*")
    .eq("codigo", codigo.toUpperCase())
    .single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (sala.status !== "lobby") return NextResponse.json({ error: "El juego ya comenzó" }, { status: 400 });

  const { data: pregunta } = await supabase
    .from("elim_arena_preguntas")
    .select("id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden")
    .eq("sala_id", sala.id)
    .eq("orden", 1)
    .single();

  if (!pregunta) return NextResponse.json({ error: "La sala no tiene preguntas" }, { status: 500 });

  const { count } = await supabase
    .from("elim_arena_preguntas")
    .select("id", { count: "exact", head: true })
    .eq("sala_id", sala.id);

  const endsAt = Date.now() + ROUND_SECONDS * 1000;

  const service = await createServiceClient();
  await service
    .from("elim_arena_salas")
    .update({
      status: "playing",
      pregunta_actual: 1,
      pregunta_termina_en: new Date(endsAt).toISOString(),
    })
    .eq("id", sala.id);

  const channel = supabase.channel(`arena:${codigo.toUpperCase()}`);
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
      total: count ?? 0,
      endsAt,
    },
  });

  return NextResponse.json({ success: true });
}
