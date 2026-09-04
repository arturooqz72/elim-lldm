import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tryAdvanceTurn } from "@/lib/ruleta/advance.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const service = await createServiceClient();

  let body: { force?: boolean; jugador_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Cuerpo vacío es válido — el disparo automático no manda body.
  }

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("id")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  let bypassDeadline = false;
  if (body.force === true) {
    if (!body.jugador_id) {
      return NextResponse.json({ error: "jugador_id requerido para forzar" }, { status: 400 });
    }
    const { data: jugador } = await service
      .from("ruleta_jugadores")
      .select("id")
      .eq("id", body.jugador_id)
      .eq("sala_id", sala.id)
      .maybeSingle();
    if (!jugador) return NextResponse.json({ error: "No eres jugador de esta sala" }, { status: 403 });
    bypassDeadline = true;
  }

  const { applied, error } = await tryAdvanceTurn(sala.id, bypassDeadline);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ applied });
}
