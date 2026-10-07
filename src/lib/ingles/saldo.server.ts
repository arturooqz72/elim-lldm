// src/lib/ingles/saldo.server.ts
// Lectura del saldo de Elim English (mensajes gratis de hoy + créditos).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InglesSaldo } from "@/types";
import { inglesConfig } from "./config";

/** "YYYY-MM-DD" de hoy en hora del Pacífico — el mismo día que usa la RPC. */
function hoyPacifico(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function leerSaldo(supabase: SupabaseClient, userId: string): Promise<InglesSaldo> {
  const { gratisDiarios } = inglesConfig();
  const [{ data: uso }, { data: creditos }] = await Promise.all([
    supabase.from("english_uso_diario").select("usados").eq("user_id", userId).eq("dia", hoyPacifico()).maybeSingle(),
    supabase.from("english_creditos").select("saldo").eq("user_id", userId).maybeSingle(),
  ]);
  const usados = (uso as { usados: number } | null)?.usados ?? 0;
  return {
    gratisRestantes: Math.max(0, gratisDiarios - usados),
    gratisDiarios,
    creditos: (creditos as { saldo: number } | null)?.saldo ?? 0,
  };
}
