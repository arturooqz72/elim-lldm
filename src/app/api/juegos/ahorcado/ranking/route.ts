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

  // Actualiza la fila existente solo si el nuevo score la mejora; si no,
  // no escribe nada. Se usa tanto para el caso normal (fila ya encontrada
  // por el SELECT de arriba) como para la recuperación de la carrera de
  // inserts concurrentes más abajo.
  const actualizarSiMejora = async (fila: { id: string; score: number }) => {
    if (score <= fila.score) {
      return NextResponse.json({ guardado: false, mejorado: false });
    }

    const { error } = await supabase
      .from("juego_individual_rankings")
      .update({
        score,
        metadata: { palabras_ganadas: palabrasGanadas },
        updated_at: new Date().toISOString(),
      })
      .eq("id", fila.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ guardado: true, mejorado: true });
  };

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

    if (error) {
      // 23505 = otra request concurrente de la MISMA cuenta ganó la carrera
      // entre el SELECT de arriba y este insert (doble clic, doble pestaña,
      // reintento) — no es un error real, buscamos la fila que ganó y
      // aplicamos la misma lógica de "solo actualiza si mejora" sobre ella.
      if (error.code === "23505") {
        const { data: filaGanadora } = await supabase
          .from("juego_individual_rankings")
          .select("id, score")
          .eq("game_key", GAME_KEY)
          .eq("user_id", user.id)
          .maybeSingle();
        if (filaGanadora) return actualizarSiMejora(filaGanadora);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ guardado: true, mejorado: true });
  }

  return actualizarSiMejora(existente);
}
