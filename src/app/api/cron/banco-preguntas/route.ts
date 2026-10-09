import { NextResponse } from "next/server";
import { revisarBanco } from "@/lib/trivia/generar.server";

// Generar y verificar 100 preguntas puede tardar unos minutos.
export const maxDuration = 300;

/**
 * Cron semanal (ver vercel.json) — si al banco le quedan menos de 100
 * preguntas que la mayoría de los jugadores activos no ha visto, genera
 * 100 nuevas y las deja pendientes de revisión en /admin/banco-preguntas.
 * Llama a un modelo de pago, así que exige CRON_SECRET siempre.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: "Falta CRON_SECRET" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resultado = await revisarBanco();
  console.log("[cron/banco-preguntas]", resultado.error ?? resultado.mensaje);
  return NextResponse.json(resultado, { status: resultado.error ? 500 : 200 });
}
