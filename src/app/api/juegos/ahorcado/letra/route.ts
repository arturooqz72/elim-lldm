import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adivinarLetra } from "@/lib/juegos/ahorcado.server";

// Califica una letra del Ahorcado en el servidor (ver ahorcado.server.ts):
// él decide si acertó, cuántas vidas quedan y cuántos puntos suma.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 });

  let body: { letra?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (typeof body.letra !== "string") {
    return NextResponse.json({ error: "Letra inválida" }, { status: 400 });
  }

  const resultado = await adivinarLetra(user.id, body.letra);
  if ("error" in resultado) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  return NextResponse.json(resultado);
}
