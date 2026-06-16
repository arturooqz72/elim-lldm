import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EgressClient, RoomServiceClient } from "livekit-server-sdk";

const EGRESS_ID_COLUMNS = ["youtube_egress_id", "facebook_egress_id", "tiktok_egress_id"] as const;

export async function POST(
  _request: Request,
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isHost = pláticas.host_id === user.id;
  const isAdmin = profile?.role === "admin";
  if (!isHost && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Stop any active stream egresses (YouTube, Facebook, TikTok)
  const activeEgressIds = EGRESS_ID_COLUMNS.map((column) => pláticas[column] as string | null).filter(
    (egressId): egressId is string => !!egressId
  );

  if (activeEgressIds.length > 0) {
    const egressClient = new EgressClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );

    for (const egressId of activeEgressIds) {
      try {
        await egressClient.stopEgress(egressId);
      } catch {
        // Egress may already have stopped/finished
      }
    }
  }

  // Delete LiveKit room
  if (pláticas.livekit_room_name) {
    try {
      const roomService = new RoomServiceClient(
        process.env.LIVEKIT_URL!,
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!
      );
      await roomService.deleteRoom(pláticas.livekit_room_name);
    } catch {
      // Room may already be empty/deleted
    }
  }

  // Stop relay if active
  if (pláticas.radio_output_active && process.env.RELAY_SERVICE_URL) {
    try {
      await fetch(`${process.env.RELAY_SERVICE_URL}/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RELAY_SERVICE_SECRET}`,
        },
        body: JSON.stringify({ roomName: pláticas.livekit_room_name }),
      });
    } catch {
      // Best effort
    }
  }

  await supabase
    .from("platikas")
    .update({
      status: "ended",
      radio_output_active: false,
      youtube_egress_id: null,
      facebook_egress_id: null,
      tiktok_egress_id: null,
      ended_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
