import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RoomServiceClient } from "livekit-server-sdk";

export async function POST(
  _request: Request,
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

  if (identity === pláticas.host_id) {
    return NextResponse.json({ error: "No puedes bajarte a ti mismo del escenario" }, { status: 400 });
  }

  // Revoke speaker approval so they don't remain (or re-appear) as a speaker on reload
  await supabase
    .from("platikas_requests")
    .update({ status: "completed" })
    .eq("platikas_id", id)
    .eq("user_id", identity)
    .eq("status", "approved");

  if (pláticas.livekit_room_name) {
    const roomService = new RoomServiceClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );
    try {
      await roomService.removeParticipant(pláticas.livekit_room_name, identity);
    } catch {
      // El participante ya pudo haberse desconectado
    }
  }

  return NextResponse.json({ success: true });
}
