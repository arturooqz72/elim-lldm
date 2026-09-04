import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tryStartCounting } from "@/lib/arena-publica/advance.server";

export async function POST(request: Request) {
  let body: { sala_id?: string; jugador_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { sala_id, jugador_id } = body;
  if (!sala_id || !jugador_id) {
    return NextResponse.json({ error: "sala_id y jugador_id requeridos" }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: jugador } = await service
    .from("arena_publica_jugadores")
    .select("id")
    .eq("id", jugador_id)
    .eq("sala_id", sala_id)
    .maybeSingle();

  if (!jugador) {
    return NextResponse.json({ error: "No eres jugador de esta sala" }, { status: 403 });
  }

  const { applied, error } = await tryStartCounting(sala_id, false);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ applied });
}
