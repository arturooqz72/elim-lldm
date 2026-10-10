// src/lib/ingles/retos.server.ts
// Reto del día y racha de Elim English. Solo servidor (service role).
//
// - Los retos se generan por adelantado (cron diario) y se guardan en
//   english_retos; si por algo falta el de hoy, se genera una sola vez y se
//   guarda (las visitas siguientes ya lo leen de la base de datos).
// - La racha usa la misma lógica que la Palabra del Día (calcularRacha y
//   rachaEfectiva, en hora del Pacífico): cuenta los días en que la persona
//   completó el reto o usó al menos 3 mensajes (english_uso_diario, que no
//   se borra aunque borre su conversación).

import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularRacha, fechaEnZona, rachaEfectiva, sumarDias } from "@/lib/palabra/logica";
import { pedirAlModelo } from "./anthropic.server";
import { inglesConfig } from "./config";
import { pedidoRetos, SISTEMA_RETOS } from "./retos-prompts";
import { hoyPacifico } from "./saldo.server";
import type { InglesRacha, InglesReto, InglesRetoAvance, InglesRetoFrase } from "@/types";

const TZ = "America/Los_Angeles";
const TEMAS_RECIENTES = 30;
/** Si falta el reto de hoy y generarlo falla, no se reintenta en cada visita. */
const ESPERA_REINTENTO_MS = 10 * 60_000;
let ultimoIntentoDeEmergencia = 0;

function texto(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;
}

/** Valida un reto que devolvió el modelo; null si no sirve. */
function validarReto(v: unknown, diasPermitidos: Set<string>): InglesReto | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const dia = typeof r.dia === "string" && diasPermitidos.has(r.dia) ? r.dia : null;
  const titulo = texto(r.titulo, 80);
  const descripcion = texto(r.descripcion, 300);
  if (!dia || !titulo || !descripcion || !Array.isArray(r.frases) || r.frases.length !== 3) return null;
  const frases: InglesRetoFrase[] = [];
  for (const f of r.frases as unknown[]) {
    const en = texto((f as Record<string, unknown> | null)?.en, 200);
    const es = texto((f as Record<string, unknown> | null)?.es, 200);
    if (!en || !es) return null;
    frases.push({ en, es });
  }
  return { dia, titulo, descripcion, frases };
}

/**
 * Genera y guarda los retos que falten de `desde` a `desde + dias - 1`, con
 * una sola llamada al modelo. Devuelve cuántos se guardaron.
 */
export async function asegurarRetos(admin: SupabaseClient, desde: string, dias: number): Promise<number> {
  const rango = Array.from({ length: dias }, (_, i) => sumarDias(desde, i));
  const { data: existentes } = await admin.from("english_retos").select("dia").in("dia", rango);
  const hay = new Set(((existentes ?? []) as { dia: string }[]).map((r) => r.dia));
  const faltan = rango.filter((d) => !hay.has(d));
  if (faltan.length === 0) return 0;

  const { data: recientes } = await admin
    .from("english_retos")
    .select("titulo")
    .order("dia", { ascending: false })
    .limit(TEMAS_RECIENTES);
  const temas = ((recientes ?? []) as { titulo: string }[]).map((r) => r.titulo);

  const respuesta = await pedirAlModelo(SISTEMA_RETOS, pedidoRetos(faltan, temas), 600 * faltan.length);
  if (!respuesta) return 0;

  let lista: unknown;
  try {
    lista = JSON.parse(respuesta.slice(respuesta.indexOf("["), respuesta.lastIndexOf("]") + 1));
  } catch {
    console.error("Elim English — los retos generados no son JSON válido");
    return 0;
  }
  const permitidos = new Set(faltan);
  const retos = (Array.isArray(lista) ? lista : [])
    .map((r) => validarReto(r, permitidos))
    .filter((r): r is InglesReto => r !== null)
    // un reto por día aunque el modelo repita alguno
    .filter((r, i, todos) => todos.findIndex((x) => x.dia === r.dia) === i);
  if (retos.length === 0) return 0;

  // ON CONFLICT DO NOTHING: si dos peticiones generan a la vez, gana la primera.
  const { error } = await admin.from("english_retos").upsert(retos, { onConflict: "dia", ignoreDuplicates: true });
  if (error) {
    console.error("Elim English — no se guardaron los retos:", error.message);
    return 0;
  }
  return retos.length;
}

/**
 * Reto de un día. Normalmente ya está guardado (cron diario); si falta, se
 * genera y se guarda (como mucho un intento cada 10 minutos por servidor,
 * para que una falla del modelo no haga lenta cada visita). null si no hay.
 */
export async function leerReto(admin: SupabaseClient, dia: string = hoyPacifico()): Promise<InglesReto | null> {
  const leer = async () => {
    const { data } = await admin.from("english_retos").select("dia, titulo, descripcion, frases").eq("dia", dia).maybeSingle();
    return (data as InglesReto | null) ?? null;
  };
  const reto = await leer();
  if (reto) return reto;
  if (Date.now() - ultimoIntentoDeEmergencia < ESPERA_REINTENTO_MS) return null;
  ultimoIntentoDeEmergencia = Date.now();
  await asegurarRetos(admin, dia, 1);
  return leer();
}

/** Día (Pacífico) de un instante. */
export function diaDe(instante: string | Date): string {
  return fechaEnZona(new Date(instante), TZ);
}

/** Mensajes del reto de hoy (pregunta y respuesta), en orden, con su id. */
export async function mensajesRetoHoy(
  admin: SupabaseClient,
  userId: string,
  dia: string = hoyPacifico(),
): Promise<{ id: string; role: "user" | "assistant"; content: string }[]> {
  // Margen de un día hacia atrás; luego se filtra por día del Pacífico.
  const desde = new Date(Date.parse(`${dia}T00:00:00Z`) - 86_400_000).toISOString();
  const { data } = await admin
    .from("english_mensajes")
    .select("id, role, content, created_at")
    .eq("user_id", userId)
    .eq("modo", "reto")
    .gte("created_at", desde)
    .order("created_at")
    .limit(100);
  return ((data ?? []) as { id: string; role: "user" | "assistant"; content: string; created_at: string }[])
    .filter((m) => diaDe(m.created_at) === dia)
    .map(({ id, role, content }) => ({ id, role, content }));
}

export async function avanceReto(
  admin: SupabaseClient,
  userId: string,
  dia: string = hoyPacifico(),
): Promise<InglesRetoAvance> {
  const [mensajes, { data: completado }] = await Promise.all([
    mensajesRetoHoy(admin, userId, dia),
    admin.from("english_retos_completados").select("dia").eq("user_id", userId).eq("dia", dia).maybeSingle(),
  ]);
  return {
    completado: Boolean(completado),
    mensajes: mensajes.filter((m) => m.role === "user").length,
    requeridos: inglesConfig().retoMensajes,
  };
}

/**
 * Marca el reto de hoy como completado. Devuelve true solo la primera vez
 * (para felicitar una sola vez).
 */
export async function completarReto(admin: SupabaseClient, userId: string, dia: string): Promise<boolean> {
  const { data, error } = await admin
    .from("english_retos_completados")
    .upsert({ user_id: userId, dia }, { onConflict: "user_id,dia", ignoreDuplicates: true })
    .select("dia");
  if (error) {
    console.error("Elim English — no se guardó el reto completado:", error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/** Racha a partir de los días que cuentan, vista desde `hoy` (lógica de la Palabra del Día). */
export function rachaDesdeFechas(fechas: string[], hoy: string): InglesRacha {
  const calculada = calcularRacha(fechas);
  const { racha } = rachaEfectiva(calculada, hoy);
  return { actual: racha.actual, maxima: calculada.maxima, hoyCuenta: fechas.includes(hoy) };
}

export async function leerRacha(admin: SupabaseClient, userId: string, hoy: string = hoyPacifico()): Promise<InglesRacha> {
  const { rachaMensajesDia } = inglesConfig();
  const [{ data: uso }, { data: retos }] = await Promise.all([
    admin.from("english_uso_diario").select("dia").eq("user_id", userId).gte("usados", rachaMensajesDia),
    admin.from("english_retos_completados").select("dia").eq("user_id", userId),
  ]);
  const fechas = [...((uso ?? []) as { dia: string }[]), ...((retos ?? []) as { dia: string }[])].map((f) => f.dia);
  return rachaDesdeFechas(fechas, hoy);
}
