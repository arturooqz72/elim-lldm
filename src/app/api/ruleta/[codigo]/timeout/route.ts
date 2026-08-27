import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS } from "@/lib/ruleta/wheel";
import { nextJugadorId } from "@/lib/ruleta/game.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const service = await createServiceClient();

  let body: { force?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // Cuerpo vacío es válido — este endpoint normalmente no lleva body.
  }

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("codigo", codigo.toUpperCase())
    .single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  if (sala.status !== "playing" || sala.turno_termina_en === null) {
    return NextResponse.json({ applied: false });
  }

  // El anfitrión puede forzar el avance de turno sin esperar a que venza el
  // reloj — es la vía de escape manual para cuando ningún cliente conectado
  // logra reportar el vencimiento automático (p. ej. una pestaña móvil
  // suspendida en segundo plano).
  let isHostForce = false;
  if (body.force === true) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id === sala.created_by) isHostForce = true;
  }

  if (!isHostForce && new Date(sala.turno_termina_en).getTime() > Date.now()) {
    return NextResponse.json({ applied: false });
  }

  const { data: jugadores } = await service
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", sala.id);

  if (!jugadores) return NextResponse.json({ applied: false });

  if (sala.turno_jugador_id === null) return NextResponse.json({ applied: false });

  const nextId = nextJugadorId(jugadores, sala.turno_jugador_id);
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { data: updated, error: updateError } = await service
    .from("ruleta_salas")
    .update({
      puede_consonante: false,
      giro_usado: false,
      turno_jugador_id: nextId,
      turno_termina_en: new Date(endsAt).toISOString(),
    })
    .eq("id", sala.id)
    .eq("turno_termina_en", sala.turno_termina_en)
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ applied: false });
  }

  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);
  await channel.send({
    type: "broadcast",
    event: "TURN_TIMEOUT",
    payload: {
      turnoJugadorId: nextId,
      turnoTerminaEn: endsAt,
      mensaje: "Se acabó el tiempo.",
    },
  });

  return NextResponse.json({ applied: true });
}
