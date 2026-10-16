// src/app/api/admin/palabra/tiktok/voz/route.ts
//
// Voz del video de TikTok de la Palabra del Día (solo admin).
//   GET  ?fecha=AAAA-MM-DD      → la voz guardada de ese día, o { voz: null }
//   POST { fecha, guion }       → la genera con ElevenLabs y la guarda en B2
// Solo días ya terminados, igual que /admin/palabra/tiktok.
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { esFechaIso, sumarDias } from "@/lib/palabra/logica";
import { PALABRA_EPOCH } from "@/lib/palabra/config";
import { fechaDeHoy } from "@/lib/palabra/servidor";
import { generarVoz, leerVoz } from "@/lib/palabra/voz.server";
import { MAX_GUION } from "@/lib/palabra/video/guion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function esAdmin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === "admin";
}

function fechaValida(fecha: unknown): fecha is string {
  return esFechaIso(fecha) && fecha >= PALABRA_EPOCH && fecha <= sumarDias(fechaDeHoy(), -1);
}

function fallo(e: unknown, porDefecto: string) {
  console.error("[palabra/tiktok/voz]", e);
  return NextResponse.json({ error: e instanceof Error ? e.message : porDefecto }, { status: 502 });
}

export async function GET(request: Request) {
  if (!(await esAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const fecha = new URL(request.url).searchParams.get("fecha");
  if (!fechaValida(fecha)) return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });

  try {
    return NextResponse.json({ voz: await leerVoz(fecha) });
  } catch (e) {
    return fallo(e, "No se pudo leer la voz guardada.");
  }
}

export async function POST(request: Request) {
  if (!(await esAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { fecha?: unknown; guion?: unknown };
  if (!fechaValida(body.fecha)) return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });

  const guion = typeof body.guion === "string" ? body.guion.replace(/\s+/g, " ").trim() : "";
  if (!guion) return NextResponse.json({ error: "El guion está vacío." }, { status: 400 });
  if (guion.length > MAX_GUION) {
    return NextResponse.json({ error: `El guion pasa de ${MAX_GUION} caracteres.` }, { status: 400 });
  }

  try {
    return NextResponse.json({ voz: await generarVoz(body.fecha, guion) });
  } catch (e) {
    return fallo(e, "No se pudo generar la voz.");
  }
}
