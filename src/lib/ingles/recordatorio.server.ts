// src/lib/ingles/recordatorio.server.ts
// Recordatorio diario de Elim English (Web Push). Solo servidor (service role).
//
// - Un recordatorio al día como máximo (english_push_envios tiene UNIQUE
//   user_id + día del Pacífico), y solo si ese día todavía no practicó:
//   no mandó mensajes, no usó la voz y no completó el reto.
// - Usa las mismas claves VAPID que los avisos de los juegos (webpush.ts),
//   pero sus propias suscripciones (english_push_suscripciones).

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotification, type PushPayload } from "@/lib/push/webpush";
import { hoyPacifico } from "./saldo.server";
import { leerRacha, leerReto } from "./retos.server";
import { alAzar } from "./saludos";

interface Suscripcion {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const TITULO = "Elim English";
const MENSAJES_RETO = [
  "Tu reto de inglés de hoy te espera 📖",
  "Tu tutora te espera para practicar 5 minutos hoy 💬",
  "📖 Hay un reto nuevo de inglés para hoy. ¿Lo hacemos?",
];

function mensajeRacha(dias: number): string {
  return alAzar([
    `¡No pierdas tu racha de ${dias} ${dias === 1 ? "día" : "días"}! 🔥`,
    `🔥 Llevas ${dias} ${dias === 1 ? "día" : "días"} seguidos. ¡Practica hoy para no perder tu racha!`,
  ]);
}

/** Manda a todas las suscripciones de una persona; borra las que ya no sirven. Devuelve cuántas se entregaron. */
async function mandarA(admin: SupabaseClient, subs: Suscripcion[], payload: PushPayload): Promise<number> {
  let entregados = 0;
  for (const sub of subs) {
    try {
      const vigente = await sendPushNotification(sub, payload);
      if (vigente) entregados++;
      else await admin.from("english_push_suscripciones").delete().eq("id", sub.id);
    } catch (err) {
      console.error("Elim English — no se mandó un recordatorio:", (err as Error).message);
    }
  }
  return entregados;
}

async function suscripcionesPorPersona(admin: SupabaseClient, userId?: string): Promise<Map<string, Suscripcion[]>> {
  let consulta = admin.from("english_push_suscripciones").select("id, user_id, endpoint, p256dh, auth");
  if (userId) consulta = consulta.eq("user_id", userId);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const porPersona = new Map<string, Suscripcion[]>();
  for (const s of (data ?? []) as Suscripcion[]) {
    porPersona.set(s.user_id, [...(porPersona.get(s.user_id) ?? []), s]);
  }
  return porPersona;
}

/** Quienes ya practicaron hoy: mensajes, voz o reto completado. */
async function practicaronHoy(admin: SupabaseClient, ids: string[], dia: string): Promise<Set<string>> {
  const [uso, voz, retos] = await Promise.all([
    admin.from("english_uso_diario").select("user_id").eq("dia", dia).gt("usados", 0).in("user_id", ids),
    admin.from("english_voz_diario").select("user_id").eq("dia", dia).gt("usados", 0).in("user_id", ids),
    admin.from("english_retos_completados").select("user_id").eq("dia", dia).in("user_id", ids),
  ]);
  return new Set(
    [...(uso.data ?? []), ...(voz.data ?? []), ...(retos.data ?? [])].map((f) => (f as { user_id: string }).user_id),
  );
}

export interface ResultadoEnvio {
  dia: string;
  personas: number;
  yaPracticaron: number;
  yaEnviados: number;
  enviados: number;
  entregados: number;
}

/** Cron diario (6 pm del Pacífico): un recordatorio a quien no ha practicado hoy. */
export async function enviarRecordatorios(admin: SupabaseClient): Promise<ResultadoEnvio> {
  const dia = hoyPacifico();
  const porPersona = await suscripcionesPorPersona(admin);
  const ids = [...porPersona.keys()];
  const resultado: ResultadoEnvio = { dia, personas: ids.length, yaPracticaron: 0, yaEnviados: 0, enviados: 0, entregados: 0 };
  if (ids.length === 0) return resultado;

  const practicaron = await practicaronHoy(admin, ids, dia);
  const reto = await leerReto(admin, dia);

  for (const userId of ids) {
    if (practicaron.has(userId)) {
      resultado.yaPracticaron++;
      continue;
    }
    const racha = await leerRacha(admin, userId, dia);
    const tipo = racha.actual > 0 ? "racha" : "reto";

    // Primero se aparta el envío de hoy: si el cron corriera dos veces, el
    // segundo choca con el UNIQUE (user_id, dia) y no se manda nada.
    const { data: envio, error } = await admin
      .from("english_push_envios")
      .insert({ user_id: userId, dia, tipo })
      .select("id")
      .maybeSingle();
    if (error || !envio) {
      resultado.yaEnviados++;
      continue;
    }

    const cuerpo = tipo === "racha" ? mensajeRacha(racha.actual) : alAzar(MENSAJES_RETO);
    const entregados = await mandarA(admin, porPersona.get(userId)!, {
      title: TITULO,
      body: reto && tipo === "reto" ? `${cuerpo}\n${reto.titulo}` : cuerpo,
      url: `/ingles?aviso=${(envio as { id: number }).id}`,
    });
    await admin.from("english_push_envios").update({ entregados }).eq("id", (envio as { id: number }).id);
    resultado.enviados++;
    resultado.entregados += entregados;
  }
  return resultado;
}

/**
 * Notificación de prueba para el admin, a sus propios teléfonos. No se
 * guarda como envío: no cuenta en las estadísticas ni gasta el recordatorio de hoy.
 */
export async function enviarPrueba(admin: SupabaseClient, userId: string): Promise<{ suscripciones: number; entregados: number }> {
  const subs = (await suscripcionesPorPersona(admin, userId)).get(userId) ?? [];
  const racha = await leerRacha(admin, userId);
  const entregados = await mandarA(admin, subs, {
    title: TITULO,
    body: racha.actual > 0 ? mensajeRacha(racha.actual) : alAzar(MENSAJES_RETO),
    url: "/ingles?aviso=prueba",
  });
  return { suscripciones: subs.length, entregados };
}
