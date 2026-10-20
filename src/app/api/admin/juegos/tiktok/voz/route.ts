// src/app/api/admin/juegos/tiktok/voz/route.ts
//
// Voz del video "Campeones de la semana" (solo admin). `fecha` es el lunes
// de la semana; solo semanas ya terminadas.
//   GET  ?fecha=AAAA-MM-DD      → la voz guardada de esa semana, o { voz: null }
//   POST { fecha, guion }       → la genera con ElevenLabs y la guarda en B2
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { fechaDeHoy } from "@/lib/palabra/servidor";
import { generarVoz, leerVoz } from "@/lib/palabra/voz.server";
import { MAX_GUION } from "@/lib/palabra/video/guion";
import { lunesValido } from "@/lib/juegos/campeones/semana";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CARPETA = "campeones-tiktok";

function fallo(e: unknown, porDefecto: string) {
  console.error("[juegos/tiktok/voz]", e);
  return NextResponse.json({ error: e instanceof Error ? e.message : porDefecto }, { status: 502 });
}

export async function GET(request: Request) {
  if ((await getProfile())?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const fecha = new URL(request.url).searchParams.get("fecha");
  if (!lunesValido(fecha, fechaDeHoy())) return NextResponse.json({ error: "Semana no válida" }, { status: 400 });

  try {
    return NextResponse.json({ voz: await leerVoz(fecha, CARPETA) });
  } catch (e) {
    return fallo(e, "No se pudo leer la voz guardada.");
  }
}

export async function POST(request: Request) {
  if ((await getProfile())?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { fecha?: unknown; guion?: unknown };
  if (!lunesValido(body.fecha, fechaDeHoy())) return NextResponse.json({ error: "Semana no válida" }, { status: 400 });

  const guion = typeof body.guion === "string" ? body.guion.replace(/\s+/g, " ").trim() : "";
  if (!guion) return NextResponse.json({ error: "El guion está vacío." }, { status: 400 });
  if (guion.length > MAX_GUION) {
    return NextResponse.json({ error: `El guion pasa de ${MAX_GUION} caracteres.` }, { status: 400 });
  }

  try {
    return NextResponse.json({ voz: await generarVoz(body.fecha, guion, CARPETA) });
  } catch (e) {
    return fallo(e, "No se pudo generar la voz.");
  }
}
