import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EgressClient, StreamOutput, StreamProtocol } from "livekit-server-sdk";

const EGRESS_ID_COLUMNS = {
  youtube: "youtube_egress_id",
  facebook: "facebook_egress_id",
  tiktok: "tiktok_egress_id",
} as const;

type Platform = keyof typeof EGRESS_ID_COLUMNS;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { platform, action, rtmpUrl, streamKey } = body as {
    platform: Platform;
    action: "start" | "stop";
    rtmpUrl?: string;
    streamKey?: string;
  };

  if (!(platform in EGRESS_ID_COLUMNS)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  if (action !== "start" && action !== "stop") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

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

  const column = EGRESS_ID_COLUMNS[platform];
  const egressClient = new EgressClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!
  );

  if (action === "stop") {
    const existingEgressId = pláticas[column] as string | null;
    if (existingEgressId) {
      try {
        await egressClient.stopEgress(existingEgressId);
      } catch {
        // Egress may already have stopped/finished
      }
    }

    await supabase
      .from("platikas")
      .update({ [column]: null })
      .eq("id", id);

    return NextResponse.json({ [column]: null });
  }

  // action === "start"
  if (!rtmpUrl || !streamKey) {
    return NextResponse.json({ error: "rtmpUrl y streamKey son requeridos" }, { status: 400 });
  }
  if (pláticas[column]) {
    return NextResponse.json({ error: "Ya hay una transmisión activa para esta plataforma" }, { status: 400 });
  }
  if (!pláticas.livekit_room_name) {
    return NextResponse.json({ error: "No hay sala LiveKit activa" }, { status: 400 });
  }

  const separator = rtmpUrl.endsWith("/") ? "" : "/";
  const streamUrl = `${rtmpUrl}${separator}${streamKey}`;

  try {
    const egressInfo = await egressClient.startRoomCompositeEgress(
      pláticas.livekit_room_name,
      new StreamOutput({
        protocol: StreamProtocol.RTMP,
        urls: [streamUrl],
      }),
      { layout: "speaker" }
    );

    await supabase
      .from("platikas")
      .update({ [column]: egressInfo.egressId })
      .eq("id", id);

    return NextResponse.json({ [column]: egressInfo.egressId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al iniciar la transmisión" },
      { status: 500 }
    );
  }
}
