import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateLiveKitToken, type ParticipantRole } from "@/lib/livekit/tokens";

// El rol (viewer/speaker/host) se decide 100% aquí, contra la base de
// datos — nunca a partir de lo que el cliente diga ser. Antes esta ruta
// confiaba en un `participantRole` enviado por el cliente y solo bloqueaba
// el rol "participante"; cualquier otra cuenta (admin, anfitrion,
// moderador, super_moderador) podía pedir directamente "host" (que incluye
// roomAdmin: mutear/expulsar a cualquiera) para CUALQUIER sala, sin pasar
// por la cola de solicitudes — justo el "alguien puede interrumpir un
// live" que se quería evitar.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { platikaId } = (await request.json()) as { platikaId?: string };
  if (!platikaId) {
    return NextResponse.json({ error: "Missing platikaId" }, { status: 400 });
  }

  const { data: platika } = await supabase
    .from("platikas")
    .select("id, host_id, status, livekit_room_name")
    .eq("id", platikaId)
    .single();

  if (!platika || !platika.livekit_room_name) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let role: ParticipantRole = "viewer";

  if (platika.host_id === user.id) {
    role = "host";
  } else if (platika.status === "live") {
    const { data: approvedRequest } = await supabase
      .from("platikas_requests")
      .select("status")
      .eq("platikas_id", platikaId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle();

    if (approvedRequest) role = "speaker";
  }

  try {
    const token = await generateLiveKitToken({
      roomName: platika.livekit_room_name,
      participantIdentity: user.id,
      participantName: profile.display_name,
      role,
    });

    return NextResponse.json({
      token,
      wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    });
  } catch (err) {
    console.error("[api/livekit/token] failed to generate token", { platikaId, role, err });
    return NextResponse.json({ error: "Failed to generate LiveKit token" }, { status: 500 });
  }
}
