import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siguientePalabra } from "@/lib/juegos/ahorcado.server";
import { esDificultad } from "@/lib/juegos/ahorcado-dificultad";

// Palabra para jugar al Ahorcado (ver ahorcado.server.ts). Devuelve solo
// lo que el navegador puede ver: letras acertadas, vidas, puntos y las
// pistas ya pedidas — nunca la palabra ni la cita mientras se juega.
// Con { dificultad } empieza una racha nueva en ese nivel; sin cuerpo,
// sigue la partida o la racha, o responde { necesitaDificultad: true }.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 });

  let body: { dificultad?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // sin cuerpo: seguir con la partida actual o la racha
  }
  if (body.dificultad !== undefined && !esDificultad(body.dificultad)) {
    return NextResponse.json({ error: "Dificultad inválida" }, { status: 400 });
  }

  const resultado = await siguientePalabra(user.id, body.dificultad ?? null);
  if ("error" in resultado) return NextResponse.json({ error: resultado.error }, { status: 500 });
  return NextResponse.json(resultado);
}
