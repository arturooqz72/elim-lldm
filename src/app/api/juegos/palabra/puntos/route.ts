// src/app/api/juegos/palabra/puntos/route.ts
//
// Panel "Ver puntos": quién resolvió hoy, últimos 7 días, rachas e
// iglesias. Los puntos se calculan en el servidor (ver puntos.server.ts).
// Con sesión, marca la fila de quien mira; sin sesión, solo las listas.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fechaDeHoy } from "@/lib/palabra/servidor";
import { getPanelPuntos } from "@/lib/palabra/puntos.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    const panel = await getPanelPuntos(fechaDeHoy(), user?.id ?? null);
    return NextResponse.json(panel, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[palabra] panel de puntos:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudieron cargar los puntos. Intenta de nuevo." }, { status: 500 });
  }
}
