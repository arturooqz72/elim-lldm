import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateLiveKitToken } from "@/lib/livekit/tokens";

// Micrófono opcional en Arena Abierta — a diferencia de Ruleta en línea,
// aquí NO se exige cuenta: todo el juego es sin login por diseño (entras
// con solo tu nombre), así que el candado también es sin cuenta. Se
// verifica que jugador_id sea realmente un jugador de esa sala (misma
// prueba de pertenencia que ya usan /answer y el resto de las rutas de
// este juego) en vez de validar contra auth.getUser().
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

  const { data: jugador } = await service
    .from("arena_publica_jugadores")
    .select("nombre")
    .eq("id", jugador_id)
    .eq("sala_id", sala_id)
    .maybeSingle();

  if (!jugador) {
    return NextResponse.json({ error: "No eres jugador de esta sala" }, { status: 403 });
  }

  const token = await generateLiveKitToken({
    roomName: `arena-publica-${sala_id}`,
    participantIdentity: jugador_id,
    participantName: jugador.nombre,
    role: "speaker",
  });

  return NextResponse.json({ token, wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL });
}
