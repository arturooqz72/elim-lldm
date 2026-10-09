import { NextResponse } from "next/server";
import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { BANCO_SET_ID, NIVELES } from "@/lib/trivia/banco";
import { revolver, revolverOpciones } from "@/lib/trivia/banco.server";
import type { AnswerOption, Question } from "@/types";

// Por nivel en una sesión con el Banco bíblico: 5 fáciles, 5 normales y
// 5 difíciles, en ese orden.
const POR_NIVEL = 5;

const COLUMNAS =
  "id, question_set_id, question_text, option_a, option_b, option_c, option_d, correct_option, bible_reference, time_limit_seconds, points, order_index, created_at, dificultad, categoria, activa, estado, origen, veces_respondida, veces_acertada";

/**
 * Preguntas para una sesión de Trivia TikTok. Solo para el anfitrión
 * (admin/anfitrión): su panel necesita la respuesta correcta para
 * pasársela al bridge, que es quien califica los comentarios. Los
 * espectadores nunca la reciben. Desde 0071 la tabla questions ya no se
 * puede leer desde el navegador.
 */
export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin" && profile.role !== "anfitrion") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const setId = new URL(request.url).searchParams.get("set");
  if (!setId) return NextResponse.json({ error: "Falta el set" }, { status: 400 });

  const service = await createServiceClient();

  let preguntas: Question[];

  if (setId === BANCO_SET_ID) {
    // Los espectadores de TikTok no tienen cuenta, así que no hay historial
    // por persona: se toman las menos usadas de cada nivel (al azar entre
    // empates) y se ordenan de fácil a difícil.
    const porNivel = await Promise.all(
      NIVELES.map(async (nivel) => {
        const { data } = await service
          .from("questions")
          .select(COLUMNAS)
          .eq("estado", "aprobada")
          .eq("activa", true)
          .eq("dificultad", nivel)
          .order("veces_respondida")
          .limit(POR_NIVEL * 6);
        return revolver((data ?? []) as Question[])
          .sort((a, b) => a.veces_respondida - b.veces_respondida)
          .slice(0, POR_NIVEL);
      })
    );
    preguntas = porNivel.flat();
  } else {
    const { data } = await service
      .from("questions")
      .select(COLUMNAS)
      .eq("question_set_id", setId)
      .eq("estado", "aprobada")
      .eq("activa", true)
      .order("order_index");
    preguntas = (data ?? []) as Question[];
  }

  // Opciones revueltas en cada sesión.
  const revueltas = preguntas.map((q) => {
    const o = revolverOpciones(q);
    return {
      ...q,
      option_a: o.opcion_a,
      option_b: o.opcion_b,
      option_c: o.opcion_c,
      option_d: o.opcion_d,
      correct_option: o.correcta as AnswerOption,
    };
  });

  return NextResponse.json({ preguntas: revueltas });
}
