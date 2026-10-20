// src/app/api/admin/juegos/tiktok/voz/audio/route.ts
//
// El MP3 de la voz de una semana de Campeones, bajado de B2 por el
// servidor (solo admin). ?v=<creada> cambia al regenerar, así el navegador
// nunca reusa la voz anterior de su caché.
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { esFechaIso } from "@/lib/palabra/logica";
import { audioDeVoz } from "@/lib/palabra/voz.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if ((await getProfile())?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fecha = new URL(request.url).searchParams.get("fecha");
  if (!esFechaIso(fecha)) return NextResponse.json({ error: "Semana no válida" }, { status: 400 });

  try {
    const audio = await audioDeVoz(fecha, "campeones-tiktok");
    if (!audio?.body) return NextResponse.json({ error: "Esta semana no tiene voz" }, { status: 404 });
    return new Response(audio.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    console.error("[juegos/tiktok/voz/audio]", e);
    return NextResponse.json({ error: "No se pudo bajar la voz." }, { status: 502 });
  }
}
