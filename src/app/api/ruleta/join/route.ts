import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateOpenRoom } from "@/lib/ruleta/room.server";
import { tryStartMatch } from "@/lib/ruleta/advance.server";
import { MIN_PLAYERS, MAX_PLAYERS } from "@/lib/ruleta/wheel";

// Deliberadamente SIN [codigo] en la ruta — a diferencia de las demás
// rutas de Ruleta (que ya operan dentro de una sala conocida), esta es la
// única que puede terminar CREANDO una sala nueva, y solo puede hacerlo
// con la preferencia real del jugador (jugadores_deseados) si es la
// primera llamada en tocar el tema. Si getOrCreateOpenRoom() se llamara
// primero desde la página (con el valor por defecto) y solo después desde
// aquí, la sala ya existiría con el default y esta preferencia se
// ignoraría siempre — por eso la página (ver room page) usa una función de
// solo lectura (peekOpenRoom) que nunca crea nada, y es esta ruta la que
// de verdad decide con qué meta nace una sala nueva.
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
    MIN_PLAYERS,
    Math.min(MAX_PLAYERS, Math.round(body.jugadores_deseados ?? MIN_PLAYERS))
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

  const service = await createServiceClient();

  // Re-verifica el estado justo antes de insertar: si la sala pasó a
  // 'playing' en la ventana entre el getOrCreateOpenRoom() de arriba y
  // este punto, evitamos insertar un jugador "fantasma" en una partida que
  // ya arrancó y que nunca podrá jugar.
  const { data: salaFresca, error: salaFrescaError } = await service
    .from("ruleta_salas")
    .select("status")
    .eq("id", sala.id)
    .single();

  if (salaFrescaError || !salaFresca) {
    return NextResponse.json(
      { error: salaFrescaError?.message ?? "No hay sala disponible" },
      { status: 500 }
    );
  }

  if (salaFresca.status !== "lobby") {
    return NextResponse.json(
      { error: "La partida actual ya empezó — espera a que termine para unirte a la siguiente." },
      { status: 400 }
    );
  }

  const { data: existente } = await service
    .from("ruleta_jugadores")
    .select("id")
    .eq("sala_id", sala.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existente) return NextResponse.json({ jugador_id: existente.id, codigo: sala.codigo });

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
      if (jugadorGanador) return NextResponse.json({ jugador_id: jugadorGanador.id, codigo: sala.codigo });
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

  return NextResponse.json({ jugador_id: jugador.id, codigo: sala.codigo });
}
