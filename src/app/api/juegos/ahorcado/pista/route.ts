import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pedirPista } from "@/lib/juegos/ahorcado.server";

// Siguiente pista del Ahorcado (ver pedirPista en ahorcado.server.ts): el
// servidor decide si se puede dar y cuánto cuesta según la dificultad.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 });

  const resultado = await pedirPista(user.id);
  if ("error" in resultado) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  return NextResponse.json(resultado);
}
