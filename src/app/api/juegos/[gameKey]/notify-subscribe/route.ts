import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_KEYS = new Set(["arena_abierta", "ruleta"]);

export async function POST(_request: Request, { params }: { params: Promise<{ gameKey: string }> }) {
  const { gameKey } = await params;
  if (!VALID_KEYS.has(gameKey)) {
    return NextResponse.json({ error: "Juego desconocido" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("game_notify_subscriptions")
    .upsert({ user_id: user.id, game_key: gameKey }, { onConflict: "user_id,game_key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ gameKey: string }> }) {
  const { gameKey } = await params;
  if (!VALID_KEYS.has(gameKey)) {
    return NextResponse.json({ error: "Juego desconocido" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("game_notify_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("game_key", gameKey);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
