import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EgressClient, StreamOutput, StreamProtocol } from "livekit-server-sdk";
import { decryptStreamKey } from "@/lib/crypto/destinos";
import { getValidYoutubeAccessToken } from "@/lib/youtube/oauth";
import { createAndBindBroadcast, completeBroadcast } from "@/lib/youtube/live";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; destinoId: string }> }
) {
  const { id, destinoId } = await params;
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

  const body = await request.json();
  const { action } = body as { action?: "start" | "stop" };
  if (action !== "start" && action !== "stop") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const egressClient = new EgressClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!
  );

  if (action === "stop") {
    const { data: egreso } = await supabase
      .from("platikas_stream_egresos")
      .select("id, egress_id, youtube_broadcast_id")
      .eq("platika_id", id)
      .eq("destino_id", destinoId)
      .is("stopped_at", null)
      .single();

    if (!egreso) {
      return NextResponse.json(
        { error: "No hay una transmisión activa para este destino" },
        { status: 400 }
      );
    }

    try {
      await egressClient.stopEgress(egreso.egress_id);
    } catch {
      // El egress puede haber terminado ya por su cuenta
    }

    if (egreso.youtube_broadcast_id) {
      try {
        const accessToken = await getValidYoutubeAccessToken();
        await completeBroadcast(accessToken, egreso.youtube_broadcast_id as string);
      } catch {
        // Mejor esfuerzo — enableAutoStop lo termina solo de todas formas
      }
    }

    await supabase
      .from("platikas_stream_egresos")
      .update({ stopped_at: new Date().toISOString() })
      .eq("id", egreso.id);

    return NextResponse.json({ isActive: false });
  }

  // action === "start"
  const { data: existingActive } = await supabase
    .from("platikas_stream_egresos")
    .select("id")
    .eq("platika_id", id)
    .eq("destino_id", destinoId)
    .is("stopped_at", null)
    .limit(1);

  if ((existingActive?.length ?? 0) > 0) {
    return NextResponse.json(
      { error: "Ya hay una transmisión activa para este destino" },
      { status: 400 }
    );
  }
  if (!pláticas.livekit_room_name) {
    return NextResponse.json({ error: "No hay sala LiveKit activa" }, { status: 400 });
  }

  const { data: destino } = await supabase
    .from("destinos")
    .select("rtmp_url, stream_key_cifrado, youtube_connection_id")
    .eq("id", destinoId)
    .eq("activo", true)
    .single();

  if (!destino) return NextResponse.json({ error: "Destino no encontrado" }, { status: 404 });

  // Destino OAuth de YouTube: se crea un liveBroadcast nuevo vinculado
  // a la ingestión persistente antes de arrancar el egress — así
  // aparece en el canal con el título de la sesión y se cierra solo al
  // perder la señal (enableAutoStart/enableAutoStop).
  let youtubeBroadcastId: string | null = null;
  if (destino.youtube_connection_id) {
    try {
      const accessToken = await getValidYoutubeAccessToken();
      const { data: connection } = await supabase
        .from("youtube_connections")
        .select("stream_id")
        .eq("id", destino.youtube_connection_id)
        .single();
      if (!connection?.stream_id) {
        return NextResponse.json({ error: "El canal de YouTube no tiene una ingestión configurada" }, { status: 400 });
      }
      youtubeBroadcastId = await createAndBindBroadcast(
        accessToken,
        connection.stream_id,
        pláticas.title as string
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Error al crear la transmisión de YouTube" },
        { status: 500 }
      );
    }
  }

  const streamKey = decryptStreamKey(destino.stream_key_cifrado);
  const separator = destino.rtmp_url.endsWith("/") ? "" : "/";
  const streamUrl = `${destino.rtmp_url}${separator}${streamKey}`;

  try {
    const egressInfo = await egressClient.startRoomCompositeEgress(
      pláticas.livekit_room_name,
      new StreamOutput({
        protocol: StreamProtocol.RTMP,
        urls: [streamUrl],
      }),
      { layout: "speaker" }
    );

    await supabase.from("platikas_stream_egresos").insert({
      platika_id: id,
      destino_id: destinoId,
      egress_id: egressInfo.egressId,
      youtube_broadcast_id: youtubeBroadcastId,
    });

    return NextResponse.json({ isActive: true, egresoId: egressInfo.egressId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al iniciar la transmisión" },
      { status: 500 }
    );
  }
}
