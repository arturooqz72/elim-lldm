import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tryStartMatch } from "@/lib/ruleta/advance.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;

  let body: { jugador_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.jugador_id) {
    return NextResponse.json({ error: "jugador_id requerido" }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("id")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  const { data: jugador } = await service
    .from("ruleta_jugadores")
    .select("id")
    .eq("id", body.jugador_id)
    .eq("sala_id", sala.id)
    .maybeSingle();

  if (!jugador) {
    return NextResponse.json({ error: "No eres jugador de esta sala" }, { status: 403 });
  }

  const { applied, error } = await tryStartMatch(sala.id, false);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ applied });
}
