import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";

export async function POST() {
  const profile = await getProfile();

  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin" && profile.role !== "anfitrion") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wsUrl = process.env.ELIM_TIKTOK_BRIDGE_WS_URL;
  const key = process.env.ELIM_TIKTOK_BRIDGE_KEY;

  if (!wsUrl || !key) {
    return NextResponse.json({ error: "El bridge de trivia de TikTok no está configurado" }, { status: 503 });
  }

  return NextResponse.json({ wsUrl, key });
}
