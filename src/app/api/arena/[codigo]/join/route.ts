import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createServiceClient();

  let body: { nombre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim().slice(0, 20);
  if (!nombre) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  const { data: sala } = await supabase
    .from("elim_arena_salas")
    .select("id, status")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "lobby") {
    return NextResponse.json({ error: "El juego ya comenzó" }, { status: 400 });
  }

  const { data: jugador, error } = await supabase
    .from("elim_arena_jugadores")
    .insert({ sala_id: sala.id, nombre, puntos: 0 })
    .select("id")
    .single();

  if (error || !jugador) {
    return NextResponse.json({ error: error?.message ?? "Error al unirse" }, { status: 500 });
  }

  return NextResponse.json({ jugador_id: jugador.id });
}
