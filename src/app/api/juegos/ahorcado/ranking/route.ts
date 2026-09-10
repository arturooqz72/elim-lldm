// src/app/api/juegos/ahorcado/ranking/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GAME_KEY = "ahorcado";

// Usa el cliente normal de sesión (no service role): la RLS de
// juego_individual_rankings ya restringe cada quien a su propia fila
// (auth.uid() = user_id), que es exactamente la regla que necesitamos —
// no hace falta bypasarla.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para guardar tu puntaje" }, { status: 401 });
  }

  let body: { score?: number; palabras_ganadas?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const score = Math.round(body.score ?? NaN);
  const palabrasGanadas = Math.round(body.palabras_ganadas ?? NaN);

  if (!Number.isFinite(score) || score < 0 || !Number.isFinite(palabrasGanadas) || palabrasGanadas < 0) {
    return NextResponse.json(
      { error: "score y palabras_ganadas deben ser números válidos" },
      { status: 400 }
    );
  }

  const { data: existente, error: errorConsulta } = await supabase
    .from("juego_individual_rankings")
    .select("id, score")
    .eq("game_key", GAME_KEY)
    .eq("user_id", user.id)
    .maybeSingle();

  if (errorConsulta) {
    return NextResponse.json({ error: errorConsulta.message }, { status: 500 });
  }

  if (!existente) {
    const { error } = await supabase.from("juego_individual_rankings").insert({
      game_key: GAME_KEY,
      user_id: user.id,
      score,
      metadata: { palabras_ganadas: palabrasGanadas },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ guardado: true, mejorado: true });
  }

  if (score <= existente.score) {
    return NextResponse.json({ guardado: false, mejorado: false });
  }

  const { error } = await supabase
    .from("juego_individual_rankings")
    .update({
      score,
      metadata: { palabras_ganadas: palabrasGanadas },
      updated_at: new Date().toISOString(),
    })
    .eq("id", existente.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ guardado: true, mejorado: true });
}
