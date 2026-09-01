import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateOpenRoom } from "@/lib/arena-publica/room.server";
import { COUNTDOWN_SECONDS, MIN_JUGADORES_PARA_INICIAR } from "@/lib/arena-publica/config";

export async function POST(request: Request) {
  let body: { nombre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim().slice(0, 20);
  if (!nombre) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const { sala, error: salaError } = await getOrCreateOpenRoom();
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

  const { data: jugador, error: insertError } = await service
    .from("arena_publica_jugadores")
    .insert({ sala_id: sala.id, nombre, puntos: 0 })
    .select("id")
    .single();

  if (insertError || !jugador) {
    return NextResponse.json({ error: insertError?.message ?? "Error al unirse" }, { status: 500 });
  }

  // Si acabamos de llegar a 2 jugadores y la sala seguía en 'lobby', arranca
  // la cuenta regresiva — con guardia CAS para que, si dos joins llegan a la
  // vez, solo uno dispare la cuenta.
  const { count } = await service
    .from("arena_publica_jugadores")
    .select("id", { count: "exact", head: true })
    .eq("sala_id", sala.id);

  if ((count ?? 0) >= MIN_JUGADORES_PARA_INICIAR && sala.status === "lobby") {
    const cuentaTerminaEn = Date.now() + COUNTDOWN_SECONDS * 1000;
    const { data: updated } = await service
      .from("arena_publica_salas")
      .update({ status: "counting", cuenta_termina_en: new Date(cuentaTerminaEn).toISOString() })
      .eq("id", sala.id)
      .eq("status", "lobby")
      .select("id");

    if (updated && updated.length > 0) {
      const supabase = await createClient();
      const channel = supabase.channel(`arena-publica:${sala.id}`);
      await channel.send({
        type: "broadcast",
        event: "COUNTDOWN_START",
        payload: { cuentaTerminaEn },
      });
    }
  }

  return NextResponse.json({ jugador_id: jugador.id, sala_id: sala.id });
}
