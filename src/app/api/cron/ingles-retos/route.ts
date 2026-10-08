import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { inglesConfig } from "@/lib/ingles/config";
import { hoyPacifico } from "@/lib/ingles/saldo.server";
import { asegurarRetos } from "@/lib/ingles/retos.server";

// La llamada al modelo para una semana de retos puede tardar unos segundos.
export const maxDuration = 60;

/**
 * Cron diario (ver vercel.json) — deja generados los Retos del día de
 * Elim English desde hoy hasta ENGLISH_CHALLENGE_DAYS_AHEAD días adelante.
 * Solo genera los que falten; si ya están todos, no llama al modelo.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createServiceClient();
  const desde = hoyPacifico();
  const generados = await asegurarRetos(admin, desde, inglesConfig().retoDiasAdelanto);
  console.log(`[cron/ingles-retos] desde ${desde}: ${generados} retos nuevos`);
  return NextResponse.json({ ok: true, desde, generados });
}
