import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; identity: string }> }
) {
  const { id, identity } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pláticas } = await supabase
    .from("platikas")
    .select("host_id, livekit_room_name, status")
    .eq("id", id)
    .single();

  if (!pláticas || pláticas.status !== "live" || !pláticas.livekit_room_name) {
    return NextResponse.json({ error: "Pláticas not live" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isHost = pláticas.host_id === user.id;
  const isAdmin = profile?.role === "admin";
  if (!isHost && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { muted } = (await request.json()) as { muted: boolean };

  const roomService = new RoomServiceClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!
  );

  try {
    const participant = await roomService.getParticipant(pláticas.livekit_room_name, identity);
    const micTrack = participant.tracks.find((t) => t.source === TrackSource.MICROPHONE);

    if (!micTrack) {
      return NextResponse.json({ error: "El invitado no tiene micrófono activo" }, { status: 404 });
    }

    await roomService.mutePublishedTrack(pláticas.livekit_room_name, identity, micTrack.sid, muted);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el micrófono" }, { status: 500 });
  }
}
