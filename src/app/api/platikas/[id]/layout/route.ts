import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EgressClient, RoomServiceClient } from "livekit-server-sdk";
import { patchRoomMetadata } from "@/lib/livekit/room-metadata";
import { EGRESS_TEMPLATE_BY_LAYOUT } from "@/lib/livekit/stage-layout";
import type { StageLayout } from "@/types";

const LAYOUTS: StageLayout[] = ["solo", "lado_a_lado", "grid", "pantalla"];

export async function POST(
  request: Request,
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
  // El anfitrión ya prueba mic y cámara en backstage antes de salir al
  // aire — debe poder probar/dejar listo el layout ahí también, no
  // solo una vez en vivo (antes esto bloqueaba con 400 en backstage,
  // dejando el panel de Escenas sin responder durante toda la prueba).
  if (pláticas.status !== "live" && pláticas.status !== "backstage") {
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
  const { layout } = body as { layout?: string };
  if (!layout || !LAYOUTS.includes(layout as StageLayout)) {
    return NextResponse.json({ error: "Layout inválido" }, { status: 400 });
  }

  await supabase.from("platikas").update({ stage_layout: layout }).eq("id", id);

  if (!pláticas.livekit_room_name) {
    return NextResponse.json({ error: "No hay sala LiveKit activa" }, { status: 400 });
  }

  // Los metadatos de la sala viajan por la conexión de LiveKit que
  // todos ya tienen abierta — cada participante recibe el cambio de
  // layout en tiempo real sin necesidad de una suscripción aparte.
  const roomService = new RoomServiceClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!
  );
  await patchRoomMetadata(roomService, pláticas.livekit_room_name, {
    layout: layout as StageLayout,
  });

  // Todos los destinos activos de una plática comparten un único
  // egress (ver toggle/route.ts) — basta con actualizar su layout una
  // vez. La grabación de radio es solo audio, no le aplica.
  const { data: egresosActivos } = await supabase
    .from("platikas_stream_egresos")
    .select("egress_id")
    .eq("platika_id", id)
    .is("stopped_at", null)
    .limit(1);

  const sharedEgressId = egresosActivos?.[0]?.egress_id as string | undefined;
  if (sharedEgressId) {
    const egressClient = new EgressClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );

    await egressClient
      .updateLayout(sharedEgressId, EGRESS_TEMPLATE_BY_LAYOUT[layout as StageLayout])
      .catch(() => {
        // El egress puede haber terminado por su cuenta justo antes
      });
  }

  return NextResponse.json({ ok: true });
}
