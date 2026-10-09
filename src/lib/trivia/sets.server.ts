// src/lib/trivia/sets.server.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { BANCO_SET_ID } from "./banco";

export interface SetConConteo {
  id: string;
  title: string;
  count: number;
}

/**
 * Sets públicos con cuántas preguntas jugables tienen (aprobadas y
 * activas), con el Banco bíblico primero. Con service role: desde 0071 la
 * tabla questions solo la lee un admin, y estas listas también las ven
 * anfitriones. Solo salen títulos y conteos, nunca respuestas.
 */
export async function setsConPreguntasActivas(): Promise<SetConConteo[]> {
  const service = await createServiceClient();

  const { data: sets } = await service
    .from("question_sets")
    .select("id, title")
    .eq("is_public", true)
    .order("title");

  const conConteo = await Promise.all(
    ((sets ?? []) as { id: string; title: string }[]).map(async (s) => {
      const { count } = await service
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("question_set_id", s.id)
        .eq("estado", "aprobada")
        .eq("activa", true);
      return {
        id: s.id,
        title: s.id === BANCO_SET_ID ? "Banco bíblico (al azar, sin repetir)" : s.title,
        count: count ?? 0,
      };
    })
  );

  return conConteo.sort((a, b) => Number(b.id === BANCO_SET_ID) - Number(a.id === BANCO_SET_ID));
}
