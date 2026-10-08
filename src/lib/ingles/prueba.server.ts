// src/lib/ingles/prueba.server.ts
// Prueba sin cuenta de Elim English: identificador anónimo en cookie, IP con
// hash y lectura/traspaso de la conversación de prueba. Solo servidor.

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inglesConfig } from "./config";
import type { InglesMensaje } from "@/types";

/** Cookie httpOnly con el identificador anónimo (uuid) del visitante. */
export const COOKIE_PRUEBA = "elim_en_prueba";
const UN_ANIO = 60 * 60 * 24 * 365;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El valor de la cookie si es un uuid válido; si no, null. */
export function anonIdValido(valor: string | undefined | null): string | null {
  return valor && UUID.test(valor) ? valor.toLowerCase() : null;
}

export const opcionesCookiePrueba = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: UN_ANIO,
};

/**
 * IP del visitante con hash (no se guarda la IP en claro). En Vercel,
 * x-forwarded-for lo escribe la plataforma, así que el primer valor es la IP
 * real del visitante.
 */
export function hashIp(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "desconocida";
  const llave = process.env.ENGLISH_TRIAL_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "elim-english-prueba";
  return createHmac("sha256", llave).update(ip).digest("hex");
}

export interface EstadoPrueba {
  mensajes: Pick<InglesMensaje, "role" | "content">[];
  restantes: number;
  /** Este navegador ya pasó su prueba a una cuenta: debe iniciar sesión. */
  reclamado: boolean;
}

/** Conversación y mensajes restantes del visitante (para /ingles sin sesión). */
export async function leerPrueba(admin: SupabaseClient, anonId: string | null): Promise<EstadoPrueba> {
  const total = inglesConfig().pruebaMensajes;
  if (!anonId) return { mensajes: [], restantes: total, reclamado: false };

  const [{ data: visitante }, { data: mensajes }] = await Promise.all([
    admin.from("english_prueba_visitantes").select("usados, user_id").eq("anon_id", anonId).maybeSingle(),
    admin
      .from("english_prueba_mensajes")
      .select("role, content")
      .eq("anon_id", anonId)
      .order("created_at")
      .limit(50),
  ]);

  const v = visitante as { usados: number; user_id: string | null } | null;
  return {
    mensajes: (mensajes ?? []) as EstadoPrueba["mensajes"],
    restantes: Math.max(0, total - (v?.usados ?? 0)),
    reclamado: Boolean(v?.user_id),
  };
}

/**
 * Pasa la conversación de prueba a la cuenta (solo la primera vez; la RPC no
 * hace nada si ya se pasó o si no hubo prueba). Nunca rompe la página.
 */
export async function reclamarPrueba(admin: SupabaseClient, anonId: string, userId: string): Promise<void> {
  const { error } = await admin.rpc("english_prueba_reclamar", { p_anon: anonId, p_user: userId });
  if (error) console.error("Elim English — no se pasó la prueba a la cuenta:", error.message);
}
