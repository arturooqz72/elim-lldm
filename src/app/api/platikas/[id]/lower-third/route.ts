import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { patchRoomMetadata } from "@/lib/livekit/room-metadata";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pláticas } = await supabase
    .from("platikas")
    .select("*")
    .eq("id", id)
    .single();

  if (!pláticas) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pláticas.status !== "live") {
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

  if (!pláticas.livekit_room_name) {
    return NextResponse.json({ error: "No hay sala LiveKit activa" }, { status: 400 });
  }

  const body = await request.json();
  const { visible, title, subtitle } = body as {
    visible?: boolean;
    title?: string;
    subtitle?: string;
  };

  const roomService = new RoomServiceClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!
  );

  await patchRoomMetadata(roomService, pláticas.livekit_room_name, {
    lowerThird: {
      visible: !!visible,
      title: (title ?? "").trim().slice(0, 60),
      subtitle: (subtitle ?? "").trim().slice(0, 80),
    },
  });

  return NextResponse.json({ ok: true });
}
