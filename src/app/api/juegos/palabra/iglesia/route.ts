// src/app/api/juegos/palabra/iglesia/route.ts
//
// Guarda la iglesia o ciudad del jugador para el ranking por iglesia.
// Cadena vacía = "prefiero no decirlo" (así no se le vuelve a preguntar;
// NULL significa que nunca se le preguntó). Usa el cliente de sesión: la
// policy profiles_update_own (0001) ya limita a su propia fila.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });

  let body: { iglesia?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  if (typeof body.iglesia !== "string") {
    return NextResponse.json({ error: "Falta la iglesia o ciudad" }, { status: 400 });
  }
  const iglesia = body.iglesia.replace(/\s+/g, " ").trim();
  if (iglesia.length > 80) {
    return NextResponse.json({ error: "Máximo 80 caracteres" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update({ iglesia }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ iglesia });
}
