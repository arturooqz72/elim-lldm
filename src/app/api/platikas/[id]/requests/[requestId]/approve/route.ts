import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateLiveKitToken } from "@/lib/livekit/tokens";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  const { id, requestId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pláticas } = await supabase
    .from("platikas")
    .select("*")
    .eq("id", id)
    .single();

  if (!pláticas || pláticas.status !== "live") {
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

  const { data: reqData } = await supabase
    .from("platikas_requests")
    .select("*, profiles(display_name)")
    .eq("id", requestId)
    .eq("platikas_id", id)
    .single();

  if (!reqData || reqData.status !== "pending") {
    return NextResponse.json({ error: "Request not found or not pending" }, { status: 404 });
  }

  // Update request status
  await supabase
    .from("platikas_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  // Generate speaker token for approved user
  const { data: speakerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", reqData.user_id)
    .single();

  const token = await generateLiveKitToken({
    roomName: pláticas.livekit_room_name!,
    participantIdentity: reqData.user_id,
    participantName: speakerProfile?.display_name ?? "Invitado",
    role: "speaker",
  });

  return NextResponse.json({ token, wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL });
}
