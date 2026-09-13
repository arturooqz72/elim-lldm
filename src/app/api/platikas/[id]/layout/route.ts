import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EgressClient, RoomServiceClient } from "livekit-server-sdk";
import type { StageLayout } from "@/types";

const LAYOUTS: StageLayout[] = ["solo", "lado_a_lado", "grid", "pantalla"];

// Plantillas nativas de composite egress de LiveKit — no hay una
// plantilla "lado a lado" propia, así que se mapea a "grid" (con 2
// participantes se ve prácticamente igual).
const EGRESS_TEMPLATE: Record<StageLayout, string> = {
  solo: "single-speaker",
  lado_a_lado: "grid",
  grid: "grid",
  pantalla: "speaker",
};

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
  await roomService.updateRoomMetadata(
    pláticas.livekit_room_name,
    JSON.stringify({ layout })
  );

  // También se actualiza el layout de cada egress de streaming ya
  // activo, para que el video que sale a las plataformas coincida —
  // la grabación de radio es solo audio, no le aplica.
  const { data: egresosActivos } = await supabase
    .from("platikas_stream_egresos")
    .select("egress_id")
    .eq("platika_id", id)
    .is("stopped_at", null);

  const template = EGRESS_TEMPLATE[layout as StageLayout];
  if (egresosActivos && egresosActivos.length > 0) {
    const egressClient = new EgressClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );

    await Promise.all(
      egresosActivos.map((e) =>
        egressClient.updateLayout(e.egress_id as string, template).catch(() => {
          // El egress puede haber terminado por su cuenta justo antes
        })
      )
    );
  }

  return NextResponse.json({ ok: true });
}
