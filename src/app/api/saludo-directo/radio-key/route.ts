import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const eligible =
    profile?.role === "oyente_plus" || profile?.role === "admin" || profile?.role === "moderador";
  if (!eligible) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Service role: también cuentan las transmisiones ocultas o privadas,
  // que por RLS no le aparecen a un oyente.
  const service = await createServiceClient();
  const { data: livePláticas } = await service
    .from("platikas")
    .select("id")
    .in("status", ["live", "backstage"])
    .limit(1);

  if (livePláticas && livePláticas.length > 0) {
    return NextResponse.json(
      { error: "Hay una transmisión en vivo ahora mismo — inténtalo más tarde." },
      { status: 409 }
    );
  }

  const wsUrl = process.env.ELIM_RADIO_BRIDGE_WS_URL;
  const key = process.env.ELIM_RADIO_BRIDGE_KEY;

  if (!wsUrl || !key) {
    return NextResponse.json({ error: "Radio bridge not configured" }, { status: 503 });
  }

  return NextResponse.json({ wsUrl, key });
}
