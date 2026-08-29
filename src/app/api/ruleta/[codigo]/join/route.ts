import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { MAX_PLAYERS } from "@/lib/ruleta/wheel";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;

  // Unirse sigue sin requerir cuenta — pero si el que se une SÍ tiene
  // sesión, se etiqueta su fila con user_id para poder reconectarlo
  // automáticamente si vuelve a abrir la sala desde otro dispositivo.
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const supabase = await createServiceClient();

  let body: { nombre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim().slice(0, 20);
  if (!nombre) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const { data: sala } = await supabase
    .from("ruleta_salas")
    .select("id, status")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "lobby") {
    return NextResponse.json({ error: "El juego ya comenzó" }, { status: 400 });
  }

  if (user) {
    const { data: existing } = await supabase
      .from("ruleta_jugadores")
      .select("id")
      .eq("sala_id", sala.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ jugador_id: existing.id });
  }

  const { count } = await supabase
    .from("ruleta_jugadores")
    .select("id", { count: "exact", head: true })
    .eq("sala_id", sala.id);

  if ((count ?? 0) >= MAX_PLAYERS) {
    return NextResponse.json({ error: "La sala está llena" }, { status: 400 });
  }

  const { data: jugador, error } = await supabase
    .from("ruleta_jugadores")
    .insert({ sala_id: sala.id, nombre, orden: count ?? 0, puntos: 0, user_id: user?.id ?? null })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Alguien más se unió justo antes que tú, intenta de nuevo" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message ?? "Error al unirse" }, { status: 500 });
  }
  if (!jugador) {
    return NextResponse.json({ error: "Error al unirse" }, { status: 500 });
  }

  return NextResponse.json({ jugador_id: jugador.id });
}
