import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AnswerOption } from "@/types";

interface CreatePregunta {
  pregunta: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  respuesta_correcta: AnswerOption;
}

interface CreateBody {
  titulo?: string;
  preguntas?: CreatePregunta[];
  question_set_id?: string;
}

const ANSWER_OPTIONS: AnswerOption[] = ["a", "b", "c", "d"];
const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MIN_PREGUNTAS = 5;
const MAX_PREGUNTAS = 20;

function generateCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "anfitrion"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const service = await createServiceClient();

  let titulo = body.titulo?.trim() || "Elim Arena";
  let preguntas: CreatePregunta[];

  if (body.question_set_id) {
    // Set de preguntas ya existente (el mismo banco que usa Trivia en Vivo)
    // en vez de escribirlas a mano.
    const { data: set } = await service
      .from("question_sets")
      .select("title")
      .eq("id", body.question_set_id)
      .maybeSingle();

    if (!set) return NextResponse.json({ error: "Set de preguntas no encontrado" }, { status: 404 });

    const { data: preguntasSet, error: setPreguntasError } = await service
      .from("questions")
      .select("question_text, option_a, option_b, option_c, option_d, correct_option")
      .eq("question_set_id", body.question_set_id)
      .order("order_index")
      .limit(MAX_PREGUNTAS);

    if (setPreguntasError) {
      return NextResponse.json({ error: setPreguntasError.message }, { status: 500 });
    }
    if (!preguntasSet || preguntasSet.length < MIN_PREGUNTAS) {
      return NextResponse.json(
        { error: `Este set tiene menos de ${MIN_PREGUNTAS} preguntas` },
        { status: 400 }
      );
    }

    if (!body.titulo?.trim()) titulo = set.title;
    preguntas = preguntasSet.map((q) => ({
      pregunta: q.question_text,
      opcion_a: q.option_a,
      opcion_b: q.option_b,
      opcion_c: q.option_c,
      opcion_d: q.option_d,
      respuesta_correcta: q.correct_option as AnswerOption,
    }));
  } else {
    preguntas = body.preguntas ?? [];

    if (preguntas.length < MIN_PREGUNTAS || preguntas.length > MAX_PREGUNTAS) {
      return NextResponse.json(
        { error: `Debe haber entre ${MIN_PREGUNTAS} y ${MAX_PREGUNTAS} preguntas` },
        { status: 400 }
      );
    }

    for (const p of preguntas) {
      if (
        !p.pregunta?.trim() ||
        !p.opcion_a?.trim() ||
        !p.opcion_b?.trim() ||
        !p.opcion_c?.trim() ||
        !p.opcion_d?.trim() ||
        !ANSWER_OPTIONS.includes(p.respuesta_correcta)
      ) {
        return NextResponse.json({ error: "Pregunta inválida" }, { status: 400 });
      }
    }
  }

  // Generar código único de 4 letras
  let codigo = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode();
    const { data: existing } = await service
      .from("elim_arena_salas")
      .select("id")
      .eq("codigo", candidate)
      .maybeSingle();

    if (!existing) {
      codigo = candidate;
      break;
    }
  }

  if (!codigo) {
    return NextResponse.json({ error: "No se pudo generar un código único" }, { status: 500 });
  }

  const { data: sala, error: salaError } = await service
    .from("elim_arena_salas")
    .insert({ codigo, titulo, created_by: user.id })
    .select("id, codigo")
    .single();

  if (salaError || !sala) {
    return NextResponse.json(
      { error: salaError?.message ?? "Error al crear la sala" },
      { status: 500 }
    );
  }

  const { error: pregError } = await service.from("elim_arena_preguntas").insert(
    preguntas.map((p, i) => ({
      sala_id: sala.id,
      pregunta: p.pregunta.trim(),
      opcion_a: p.opcion_a.trim(),
      opcion_b: p.opcion_b.trim(),
      opcion_c: p.opcion_c.trim(),
      opcion_d: p.opcion_d.trim(),
      respuesta_correcta: p.respuesta_correcta,
      orden: i + 1,
    }))
  );

  if (pregError) {
    await service.from("elim_arena_salas").delete().eq("id", sala.id);
    return NextResponse.json({ error: pregError.message }, { status: 500 });
  }

  return NextResponse.json({ codigo: sala.codigo });
}
