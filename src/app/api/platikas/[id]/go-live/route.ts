import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { startProgramRecording } from "@/lib/livekit/recording";

// "Salir al aire": transiciona una sesión fuera de backstage hacia
// "live" — es el momento en que se vuelve visible/escuchable para el
// público, empieza a grabarse, y (fase 2) arrancan los destinos de
// streaming. Ver docs/superpowers/specs/2026-09-12-backstage-design.md.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_moderador"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: pláticas } = await supabase
    .from("platikas")
    .select("*")
    .eq("id", id)
    .single();

  if (!pláticas) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pláticas.host_id !== user.id && profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (pláticas.status === "live") {
    return NextResponse.json({ error: "Already live" }, { status: 400 });
  }

  let roomName = pláticas.livekit_room_name as string | null;

  if (!roomName) {
    // Defensa: si por alguna razón llegó aquí sin sala (ej. una fila
    // vieja de antes del backstage), se crea ahora en vez de fallar.
    roomName = `platikas-${id}`;
    const roomService = new RoomServiceClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );
    await roomService.createRoom({ name: roomName, emptyTimeout: 300 });
  }

  const startedAt = (pláticas.started_at as string | null) ?? new Date().toISOString();

  // Grabación automática (solo audio) — mejor esfuerzo: si B2/LiveKit
  // no están configurados, la transmisión sigue sin grabarse.
  const recordingEgressId = pláticas.programa_id
    ? await startProgramRecording(roomName, pláticas.programa_id as string, id)
    : null;

  const { error } = await supabase
    .from("platikas")
    .update({
      status: "live",
      livekit_room_name: roomName,
      started_at: startedAt,
      recording_egress_id: recordingEgressId,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ roomName });
}
