import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { forfeitMatch } from "@/lib/ruleta/advance.server";

// Llamado por el botón "Salir" mientras el cliente todavía está en la
// sala. En 'lobby' no hay partida que perder — solo se quita la fila de
// jugador para que el conteo de "esperando jugadores" quede correcto para
// el resto. En 'playing'/'ronda_fin' sí hay partida en curso: se delega a
// forfeitMatch(), que la termina para todos y hace perder a quien se sale.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const service = await createServiceClient();

  let body: { jugador_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!body.jugador_id) return NextResponse.json({ error: "jugador_id requerido" }, { status: 400 });

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("id, status")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  if (sala.status === "lobby") {
    const { error } = await service
      .from("ruleta_jugadores")
      .delete()
      .eq("id", body.jugador_id)
      .eq("sala_id", sala.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { applied, error } = await forfeitMatch(sala.id, body.jugador_id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: applied });
}
