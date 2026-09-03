import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile as { role: string }).role !== "admin") return null;
  return user;
}

async function broadcast(salaId: string, event: string, payload: object) {
  const supabase = await createClient();
  const channel = supabase.channel(`arena-publica:${salaId}`);
  await channel.httpSend(event, payload);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = await createServiceClient();

  // Termina la sala sin importar su estado actual — es el botón de pánico
  // del admin para una sala atascada (nadie conectado dispara /advance) o
  // simplemente para cerrarla a mano. El guard .neq evita un broadcast
  // redundante si dos admins la cierran a la vez o ya estaba terminada.
  const { data: updated, error } = await service
    .from("arena_publica_salas")
    .update({ status: "finished" })
    .eq("id", id)
    .neq("status", "finished")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (updated && updated.length > 0) {
    await broadcast(id, "GAME_FINISHED", {});
  }

  return NextResponse.json({ success: true });
}
