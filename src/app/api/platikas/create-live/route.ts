import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RoomServiceClient } from "livekit-server-sdk";

const LOG_TAG = "[api/platikas/create-live]";

export async function POST(request: Request) {
  console.log(`${LOG_TAG} → request received`);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.error(`${LOG_TAG} auth.getUser() error:`, authError);
  }

  if (!user) {
    console.error(`${LOG_TAG} no user in session — Unauthorized`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`${LOG_TAG} user authenticated`, { userId: user.id });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error(`${LOG_TAG} error fetching profile:`, profileError);
  }

  if (!profile || !["admin", "anfitrion"].includes(profile.role)) {
    console.error(`${LOG_TAG} role check failed — Forbidden`, { role: profile?.role });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  console.log(`${LOG_TAG} role check passed`, { role: profile.role });

  let body: { title?: string };
  try {
    body = await request.json();
  } catch (err) {
    console.error(`${LOG_TAG} failed to parse request JSON body:`, err);
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const title = body.title?.trim();
  console.log(`${LOG_TAG} parsed body`, { title });

  if (!title) {
    console.error(`${LOG_TAG} missing title — bad request`);
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
  }

  console.log(`${LOG_TAG} inserting platika row...`);
  const { data: platika, error } = await supabase
    .from("platikas")
    .insert({
      title,
      host_id: user.id,
      status: "scheduled",
    })
    .select("id")
    .single();

  if (error || !platika) {
    console.error(`${LOG_TAG} failed to insert platika row:`, error);
    return NextResponse.json(
      { error: error?.message ?? "Error al crear la sesión" },
      { status: 500 }
    );
  }

  const id = (platika as { id: string }).id;
  const roomName = `platikas-${id}`;
  console.log(`${LOG_TAG} platika row created`, { id, roomName });

  const livekitUrl = process.env.LIVEKIT_URL;
  const livekitApiKey = process.env.LIVEKIT_API_KEY;
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

  console.log(`${LOG_TAG} LiveKit env check`, {
    hasUrl: !!livekitUrl,
    hasApiKey: !!livekitApiKey,
    hasApiSecret: !!livekitApiSecret,
    url: livekitUrl,
  });

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    console.error(`${LOG_TAG} missing LiveKit environment variables`);
    return NextResponse.json(
      { error: "Configuración de LiveKit incompleta en el servidor" },
      { status: 500 }
    );
  }

  try {
    const roomService = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret);

    console.log(`${LOG_TAG} calling roomService.createRoom...`, { roomName });
    await roomService.createRoom({ name: roomName, emptyTimeout: 300 });
    console.log(`${LOG_TAG} LiveKit room created OK`, { roomName });
  } catch (err) {
    console.error(`${LOG_TAG} roomService.createRoom failed:`, err);
    return NextResponse.json(
      { error: "No se pudo crear la sala de LiveKit" },
      { status: 500 }
    );
  }

  console.log(`${LOG_TAG} updating platika row to live...`, { id });
  const { error: updateError } = await supabase
    .from("platikas")
    .update({
      status: "live",
      livekit_room_name: roomName,
      started_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error(`${LOG_TAG} failed to update platika row to live:`, updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  console.log(`${LOG_TAG} ✓ done`, { id, roomName });
  return NextResponse.json({ id });
}
