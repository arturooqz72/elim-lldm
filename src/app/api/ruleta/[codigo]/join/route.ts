import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { tryStartMatch } from "@/lib/ruleta/advance.server";
import { MIN_PLAYERS, MAX_PLAYERS } from "@/lib/ruleta/wheel";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 });
  }

  let body: { jugadores_deseados?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const jugadoresDeseados = Math.max(
    MIN_PLAYERS,
    Math.min(MAX_PLAYERS, Math.round(body.jugadores_deseados ?? MIN_PLAYERS))
  );

  const { data: profile } = await authClient
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const nombre = (profile?.display_name ?? "Jugador").slice(0, 20);

  const service = await createServiceClient();

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("id, status")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "lobby") {
    return NextResponse.json({ error: "El juego ya comenzó" }, { status: 400 });
  }

  const { data: existente } = await service
    .from("ruleta_jugadores")
    .select("id")
    .eq("sala_id", sala.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existente) return NextResponse.json({ jugador_id: existente.id });

  const { count } = await service
    .from("ruleta_jugadores")
    .select("id", { count: "exact", head: true })
    .eq("sala_id", sala.id);

  if ((count ?? 0) >= MAX_PLAYERS) {
    return NextResponse.json({ error: "La sala está llena" }, { status: 400 });
  }

  const { data: jugador, error } = await service
    .from("ruleta_jugadores")
    .insert({ sala_id: sala.id, nombre, orden: count ?? 0, puntos: 0, user_id: user.id })
    .select("id")
    .single();

  if (error) {
    // 23505 = otra request concurrente de la MISMA cuenta ganó la carrera
    // entre el check de "existente" de arriba y este insert (doble clic,
    // doble pestaña) — no es un error real, buscamos y devolvemos esa fila.
    if (error.code === "23505") {
      const { data: jugadorGanador } = await service
        .from("ruleta_jugadores")
        .select("id")
        .eq("sala_id", sala.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (jugadorGanador) return NextResponse.json({ jugador_id: jugadorGanador.id });
    }
    return NextResponse.json({ error: error.message ?? "Error al unirse" }, { status: 500 });
  }
  if (!jugador) {
    return NextResponse.json({ error: "Error al unirse" }, { status: 500 });
  }

  const { error: startError } = await tryStartMatch(sala.id, true);
  if (startError) {
    console.error(`[ruleta/join] tryStartMatch falló para sala ${sala.id}:`, startError);
  }

  return NextResponse.json({ jugador_id: jugador.id });
}
