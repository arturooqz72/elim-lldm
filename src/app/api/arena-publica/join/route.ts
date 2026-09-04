import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateOpenRoom } from "@/lib/arena-publica/room.server";
import { tryStartCounting } from "@/lib/arena-publica/advance.server";
import { MIN_JUGADORES_PARA_INICIAR, MAX_JUGADORES_POR_SALA } from "@/lib/arena-publica/config";

export async function POST(request: Request) {
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
    MIN_JUGADORES_PARA_INICIAR,
    Math.min(MAX_JUGADORES_POR_SALA, Math.round(body.jugadores_deseados ?? MIN_JUGADORES_PARA_INICIAR))
  );

  const { data: profile } = await authClient
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const nombre = (profile?.display_name ?? "Jugador").slice(0, 20);

  const { sala, error: salaError } = await getOrCreateOpenRoom(jugadoresDeseados);
  if (salaError || !sala) {
    return NextResponse.json({ error: salaError ?? "No hay sala disponible" }, { status: 500 });
  }

  if (sala.status !== "lobby" && sala.status !== "counting") {
    return NextResponse.json(
      { error: "La partida actual ya empezó — espera a que termine para unirte a la siguiente." },
      { status: 400 }
    );
  }

  const service = await createServiceClient();

  // Re-verifica el estado justo antes de insertar: si la sala pasó a
  // 'playing' en la ventana entre el getOrCreateOpenRoom() de arriba y este
  // punto, evitamos insertar un jugador "fantasma" en una partida que ya
  // arrancó y que nunca podrá jugar.
  const { data: salaFresca, error: salaFrescaError } = await service
    .from("arena_publica_salas")
    .select("status")
    .eq("id", sala.id)
    .single();

  if (salaFrescaError || !salaFresca) {
    return NextResponse.json(
      { error: salaFrescaError?.message ?? "No hay sala disponible" },
      { status: 500 }
    );
  }

  if (salaFresca.status !== "lobby" && salaFresca.status !== "counting") {
    return NextResponse.json(
      { error: "La partida actual ya empezó — espera a que termine para unirte a la siguiente." },
      { status: 400 }
    );
  }

  const { data: existente } = await service
    .from("arena_publica_jugadores")
    .select("id")
    .eq("sala_id", sala.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existente) {
    return NextResponse.json({ jugador_id: existente.id, sala_id: sala.id });
  }

  const { data: jugador, error: insertError } = await service
    .from("arena_publica_jugadores")
    .insert({ sala_id: sala.id, nombre, puntos: 0, user_id: user.id })
    .select("id")
    .single();

  if (insertError || !jugador) {
    // 23505 = violación del índice único parcial
    // idx_arena_publica_jugadores_sala_user (sala_id, user_id): otra request
    // concurrente de la misma cuenta (doble clic, doble pestaña) ganó la
    // carrera entre el check de "existente" de arriba y este insert. No es
    // un error real — ese jugador ya existe, así que lo buscamos y lo
    // devolvemos en vez de fallar.
    if (insertError?.code === "23505") {
      const { data: jugadorGanador } = await service
        .from("arena_publica_jugadores")
        .select("id")
        .eq("sala_id", sala.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (jugadorGanador) {
        return NextResponse.json({ jugador_id: jugadorGanador.id, sala_id: sala.id });
      }
    }
    return NextResponse.json({ error: insertError?.message ?? "Error al unirse" }, { status: 500 });
  }

  const { error: startError } = await tryStartCounting(sala.id, true);
  if (startError) {
    console.error(`[arena-publica/join] tryStartCounting falló para sala ${sala.id}:`, startError);
  }

  return NextResponse.json({ jugador_id: jugador.id, sala_id: sala.id });
}
