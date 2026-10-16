// src/app/api/admin/palabra/tiktok/voz/audio/route.ts
//
// El MP3 de la voz de un día, bajado de B2 por el servidor (solo admin).
// La página lo pide con ?v=<creada>: al regenerar cambia la URL, así el
// navegador nunca reusa la voz anterior de su caché.
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { esFechaIso } from "@/lib/palabra/logica";
import { audioDeVoz } from "@/lib/palabra/voz.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fecha = new URL(request.url).searchParams.get("fecha");
  if (!esFechaIso(fecha)) return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });

  try {
    const audio = await audioDeVoz(fecha);
    if (!audio?.body) return NextResponse.json({ error: "Este día no tiene voz" }, { status: 404 });
    return new Response(audio.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    console.error("[palabra/tiktok/voz/audio]", e);
    return NextResponse.json({ error: "No se pudo bajar la voz." }, { status: 502 });
  }
}
