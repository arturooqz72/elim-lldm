import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EgressClient, RoomServiceClient } from "livekit-server-sdk";
import { finalizeProgramRecording } from "@/lib/livekit/recording";

const EGRESS_ID_COLUMNS = ["youtube_egress_id", "facebook_egress_id", "tiktok_egress_id"] as const;

// La finalización de la grabación sondea a LiveKit hasta un minuto — no debe
// contar contra el timeout de la función que responde al host.
export const maxDuration = 60;

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

  const endedAt = new Date().toISOString();
  const { error: endUpdateError } = await supabase
    .from("platikas")
    .update({
      status: "ended",
      radio_output_active: false,
      youtube_egress_id: null,
      facebook_egress_id: null,
      tiktok_egress_id: null,
      recording_egress_id: null,
      ended_at: endedAt,
    })
    .eq("id", id);

  // recording_egress_id es una columna nueva (migración 0040) — si aún no
  // se aplicó en producción, no se debe dejar la sesión atorada en "live".
  if (endUpdateError) {
    console.warn("[api/platikas/end] update with recording_egress_id failed, retrying without it:", endUpdateError);
    await supabase
      .from("platikas")
      .update({
        status: "ended",
        radio_output_active: false,
        youtube_egress_id: null,
        facebook_egress_id: null,
        tiktok_egress_id: null,
        ended_at: endedAt,
      })
      .eq("id", id);
  }

  // Solo las sesiones de un Programa se graban (create-live lo exige).
  // Se finaliza después de responder para no dejar al host esperando
  // mientras LiveKit termina de subir el archivo a Backblaze.
  if (pláticas.recording_egress_id && pláticas.programa_id) {
    after(() =>
      finalizeProgramRecording({
        egressId: pláticas.recording_egress_id as string,
        programaId: pláticas.programa_id as string,
        platikaId: id,
        titulo: pláticas.title as string,
        startedAt: (pláticas.started_at as string | null) ?? new Date().toISOString(),
      })
    );
  }

  return NextResponse.json({ success: true });
}
