// src/lib/ingles/saldo.server.ts
// Lectura del saldo de Elim English: mensajes gratis de hoy, créditos e
// intentos de voz de hoy (contador aparte).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InglesSaldo } from "@/types";
import { inglesConfig } from "./config";
import { vozRestantesHoy } from "./voz.server";

/** "YYYY-MM-DD" de hoy en hora del Pacífico — el mismo día que usan las RPC. */
export function hoyPacifico(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function leerSaldo(supabase: SupabaseClient, userId: string): Promise<InglesSaldo> {
  const { gratisDiarios, vozGratisDiarios } = inglesConfig();
  const hoy = hoyPacifico();
  const [{ data: uso }, { data: creditos }, vozRestantes] = await Promise.all([
    supabase.from("english_uso_diario").select("usados").eq("user_id", userId).eq("dia", hoy).maybeSingle(),
    supabase.from("english_creditos").select("saldo").eq("user_id", userId).maybeSingle(),
    vozRestantesHoy(supabase, userId, hoy),
  ]);
  const usados = (uso as { usados: number } | null)?.usados ?? 0;
  return {
    gratisRestantes: Math.max(0, gratisDiarios - usados),
    gratisDiarios,
    creditos: (creditos as { saldo: number } | null)?.saldo ?? 0,
    vozRestantes,
    vozDiarios: vozGratisDiarios,
  };
}

/**
 * Saldo tras descontar un mensaje (lo que devuelve english_consumir_mensaje)
 * más los intentos de voz de hoy.
 */
export async function saldoTrasMensaje(
  admin: SupabaseClient,
  userId: string,
  consumo: { gratis_restantes: number; creditos: number },
): Promise<InglesSaldo> {
  const { gratisDiarios, vozGratisDiarios } = inglesConfig();
  return {
    gratisRestantes: consumo.gratis_restantes,
    gratisDiarios,
    creditos: consumo.creditos,
    vozRestantes: await vozRestantesHoy(admin, userId, hoyPacifico()),
    vozDiarios: vozGratisDiarios,
  };
}
