import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateLiveKitToken } from "@/lib/livekit/tokens";

// Micrófono opcional en La Ruleta en línea — solo para jugadores logueados
// (decisión explícita: los invitados sin cuenta siguen jugando, pero sin
// audio). Distinto de /api/livekit/token: ese exige rol anfitrion/admin
// para publicar, aquí cualquier cuenta que sea jugador de ESTA sala puede
// hablar — verificado contra su propia fila en ruleta_jugadores, no contra
// el rol del sitio.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Inicia sesión para usar el micrófono" }, { status: 401 });

  const { data: sala } = await supabase
    .from("ruleta_salas")
    .select("id")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  const { data: jugador } = await supabase
    .from("ruleta_jugadores")
    .select("nombre")
    .eq("sala_id", sala.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!jugador) {
    return NextResponse.json({ error: "No eres jugador de esta sala" }, { status: 403 });
  }

  const token = await generateLiveKitToken({
    roomName: `ruleta-${codigo.toUpperCase()}`,
    participantIdentity: user.id,
    participantName: jugador.nombre,
    role: "speaker",
  });

  return NextResponse.json({ token, wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL });
}
