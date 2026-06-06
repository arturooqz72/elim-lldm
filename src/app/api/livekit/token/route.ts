import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateLiveKitToken, type ParticipantRole } from "@/lib/livekit/tokens";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomName, participantRole } = await request.json() as {
    roomName: string;
    participantRole: ParticipantRole;
  };

  if (!roomName || !participantRole) {
    return NextResponse.json({ error: "Missing roomName or participantRole" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Only allow speaker/host roles for verified users
  if (participantRole !== "viewer" && profile.role === "participante") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = await generateLiveKitToken({
    roomName,
    participantIdentity: user.id,
    participantName: profile.display_name,
    role: participantRole,
  });

  return NextResponse.json({
    token,
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  });
}
