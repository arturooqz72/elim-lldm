import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { generarPendientes } from "@/lib/trivia/generar.server";

export const maxDuration = 300;

const MAXIMO = 10;

/**
 * Corrida de prueba de la generación con IA, solo para admin: genera
 * `cantidad` preguntas (máximo 10) sin mirar el umbral semanal y las deja
 * pendientes de revisión. Devuelve cuáles pasaron la comprobación contra
 * la RV1960, cuáles no y por qué, y los tokens usados.
 */
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { cantidad?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const cantidad = Math.max(1, Math.min(MAXIMO, Math.round(Number(body.cantidad) || 5)));

  const resultado = await generarPendientes(cantidad);
  console.log("[admin/banco-preguntas/generar]", JSON.stringify({ cantidad, ...resultado.uso, error: resultado.error }));
  return NextResponse.json({ cantidad, ...resultado }, { status: resultado.error ? 500 : 200 });
}
