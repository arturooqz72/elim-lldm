import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siguientePalabra } from "@/lib/juegos/ahorcado.server";

// Palabra para jugar al Ahorcado (ver ahorcado.server.ts). Devuelve solo
// lo que el navegador puede ver: letras acertadas, vidas y puntos — nunca
// la palabra completa mientras se juega.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 });

  let body: { reiniciar?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // sin cuerpo: seguir con la partida actual o la racha
  }

  const resultado = await siguientePalabra(user.id, body.reiniciar === true);
  if ("error" in resultado) return NextResponse.json({ error: resultado.error }, { status: 500 });
  return NextResponse.json(resultado);
}
