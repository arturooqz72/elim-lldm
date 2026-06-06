import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  if (pláticas.status !== "live") return NextResponse.json({ error: "Pláticas not live" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isHost = pláticas.host_id === user.id;
  const isAdmin = profile?.role === "admin";
  if (!isHost && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const relayUrl = process.env.RELAY_SERVICE_URL;
  const relaySecret = process.env.RELAY_SERVICE_SECRET;

  if (!relayUrl) {
    return NextResponse.json({ error: "Relay service not configured" }, { status: 503 });
  }

  const newState = !pláticas.radio_output_active;

  // Start or stop relay
  const endpoint = newState ? "/start" : "/stop";
  const relayResponse = await fetch(`${relayUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${relaySecret}`,
    },
    body: JSON.stringify({
      roomName: pláticas.livekit_room_name,
    }),
  });

  if (!relayResponse.ok) {
    return NextResponse.json({ error: "Relay service error" }, { status: 502 });
  }

  await supabase
    .from("platikas")
    .update({ radio_output_active: newState })
    .eq("id", id);

  return NextResponse.json({ radio_output_active: newState });
}
