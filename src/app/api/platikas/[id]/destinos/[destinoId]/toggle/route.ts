import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EgressClient, StreamOutput, StreamProtocol } from "livekit-server-sdk";
import { decryptStreamKey } from "@/lib/crypto/destinos";

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
      .select("id, egress_id")
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
    .select("rtmp_url, stream_key_cifrado")
    .eq("id", destinoId)
    .eq("activo", true)
    .single();

  if (!destino) return NextResponse.json({ error: "Destino no encontrado" }, { status: 404 });

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
    });

    return NextResponse.json({ isActive: true, egresoId: egressInfo.egressId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al iniciar la transmisión" },
      { status: 500 }
    );
  }
}
