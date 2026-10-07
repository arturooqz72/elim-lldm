// src/lib/ingles/progreso.server.ts
// Resumen de pronunciación: promedio reciente y sonidos que más le cuestan.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InglesSonido, PronFrase, PronProgreso } from "@/types";

const INTENTOS_PROMEDIO = 10;
const INTENTOS_SONIDOS = 30;

export async function leerProgreso(supabase: SupabaseClient, userId: string): Promise<PronProgreso> {
  const { data } = await supabase
    .from("english_pron_intentos")
    .select("puntaje, sonidos_fallados")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(INTENTOS_SONIDOS);

  const intentos = (data ?? []) as { puntaje: number | string; sonidos_fallados: InglesSonido[] }[];
  const recientes = intentos.slice(0, INTENTOS_PROMEDIO);
  const promedio = recientes.length
    ? Math.round(recientes.reduce((s, i) => s + Number(i.puntaje), 0) / recientes.length)
    : null;

  const veces = new Map<InglesSonido, number>();
  for (const i of intentos) for (const s of i.sonidos_fallados ?? []) veces.set(s, (veces.get(s) ?? 0) + 1);
  const sonidosDificiles = [...veces.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sonido, n]) => ({ sonido, veces: n }));

  return { promedio, intentos: recientes.length, sonidosDificiles };
}

/** Última frase que se le mostró al usuario en ese nivel (para retomarla). */
export async function fraseActual(supabase: SupabaseClient, userId: string, nivel: string): Promise<PronFrase | null> {
  const { data } = await supabase
    .from("english_pron_frases")
    .select("id, texto, traduccion, sonido")
    .eq("user_id", userId)
    .eq("nivel", nivel)
    .not("mostrada_at", "is", null)
    .order("mostrada_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PronFrase | null) ?? null;
}
