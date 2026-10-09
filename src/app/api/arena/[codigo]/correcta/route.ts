import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Margen para relojes un poco adelantados en el navegador.
const MARGEN_MS = 500;

/**
 * Respuesta correcta de la pregunta en curso de Elim Arena, solo cuando su
 * tiempo ya terminó. Antes de eso nadie la recibe: vive en
 * elim_arena_respuestas_correctas, que no tiene GRANTs públicos (0024).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const preguntaId = new URL(request.url).searchParams.get("pregunta_id");
  if (!preguntaId) return NextResponse.json({ error: "Falta pregunta_id" }, { status: 400 });

  const service = await createServiceClient();

  const { data: sala } = await service
    .from("elim_arena_salas")
    .select("id, status, pregunta_actual, pregunta_termina_en")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  const { data: pregunta } = await service
    .from("elim_arena_preguntas")
    .select("id, sala_id, orden")
    .eq("id", preguntaId)
    .maybeSingle();

  if (!pregunta || pregunta.sala_id !== sala.id) {
    return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
  }

  const enCurso =
    sala.status === "playing" &&
    pregunta.orden === sala.pregunta_actual &&
    (!sala.pregunta_termina_en || new Date(sala.pregunta_termina_en).getTime() - MARGEN_MS > Date.now());
  const futura = pregunta.orden > sala.pregunta_actual;

  if (enCurso || futura) {
    return NextResponse.json({ error: "Todavía no termina el tiempo de esta pregunta" }, { status: 425 });
  }

  const { data: correcta } = await service
    .from("elim_arena_respuestas_correctas")
    .select("respuesta_correcta")
    .eq("pregunta_id", preguntaId)
    .maybeSingle();

  return NextResponse.json({ respuesta_correcta: correcta?.respuesta_correcta ?? null });
}
