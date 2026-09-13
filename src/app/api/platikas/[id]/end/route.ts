import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EgressClient, RoomServiceClient } from "livekit-server-sdk";
import { finalizeProgramRecording } from "@/lib/livekit/recording";

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

  // Detener cualquier destino de streaming todavía activo (ver
  // docs/superpowers/specs/2026-09-13-destinos-multiples-design.md).
  const { data: egresosActivos } = await supabase
    .from("platikas_stream_egresos")
    .select("id, egress_id")
    .eq("platika_id", id)
    .is("stopped_at", null);

  if (egresosActivos && egresosActivos.length > 0) {
    const egressClient = new EgressClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );

    for (const egreso of egresosActivos) {
      try {
        await egressClient.stopEgress(egreso.egress_id);
      } catch {
        // Egress may already have stopped/finished
      }
    }

    await supabase
      .from("platikas_stream_egresos")
      .update({ stopped_at: new Date().toISOString() })
      .in(
        "id",
        egresosActivos.map((e) => e.id)
      );
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
