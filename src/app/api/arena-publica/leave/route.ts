import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { forfeitMatch } from "@/lib/arena-publica/advance.server";

// Llamado por el botón "Salir" mientras el cliente todavía está en la
// sala. En 'lobby' no hay partida que perder — solo se quita la fila de
// jugador para que el conteo de "esperando jugadores" quede correcto para
// el resto. En 'counting'/'playing'/'reveal' sí hay partida en curso: se
// delega a forfeitMatch(), que la termina para todos y hace perder a quien
// se sale.
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

  const { data: sala } = await service
    .from("arena_publica_salas")
    .select("id, status")
    .eq("id", sala_id)
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  if (sala.status === "lobby") {
    const { error } = await service
      .from("arena_publica_jugadores")
      .delete()
      .eq("id", jugador_id)
      .eq("sala_id", sala.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { applied, error } = await forfeitMatch(sala.id, jugador_id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: applied });
}
