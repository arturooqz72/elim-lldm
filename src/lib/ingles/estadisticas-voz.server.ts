// src/lib/ingles/estadisticas-voz.server.ts
// Práctica de voz de Elim English para /admin/ingles: intentos por día (chat,
// modo Pronunciación y prueba sin cuenta), costo estimado de Azure, quién
// llegó al límite de voz y las encuestas "¿Pagarías…?". Sin cuentas admin.
// Solo servidor (service role).

import type { SupabaseClient } from "@supabase/supabase-js";
import { inglesConfig } from "./config";
import { diaPacifico, todas } from "./estadisticas.server";
import type { EncuestaRespuesta, EncuestaTipo } from "@/types";

/** Duración supuesta si un intento no guardó cuánto duró. */
const SEGUNDOS_SIN_DATO = 5;

export interface DiaVoz {
  dia: string;
  /** Tarjetas 🎤 dentro del chat (con cuenta). */
  chat: number;
  /** Modo Pronunciación. */
  modo: number;
  /** Prueba sin cuenta. */
  prueba: number;
  /** Personas que llegaron al límite de voz ese día. */
  alLimite: number;
  costoAzureUsd: number;
}

export interface PersonaLimiteVoz {
  nombre: string;
  /** Días (del rango) que usó todos sus intentos de voz. */
  diasAlLimite: number;
  ultimoDia: string;
}

export interface ResumenEncuesta {
  tipo: EncuestaTipo;
  respuestas: Record<EncuestaRespuesta, number>;
  total: number;
}

export interface PersonaQuePagaria {
  nombre: string;
  tipo: EncuestaTipo;
  respuesta: Exclude<EncuestaRespuesta, "no">;
  /** Días distintos que ha usado la tutora (mensajes o voz), desde siempre. */
  diasUso: number;
}

export interface EstadisticasVoz {
  dias: DiaVoz[];
  totales: { chat: number; modo: number; prueba: number; costoAzureUsd: number };
  alLimite: PersonaLimiteVoz[];
  encuestas: ResumenEncuesta[];
  pagarian: PersonaQuePagaria[];
}

function redondear(usd: number): number {
  return Math.round(usd * 100) / 100;
}

export async function leerEstadisticasVoz(supabase: SupabaseClient, numDias: number): Promise<EstadisticasVoz> {
  const { vozGratisDiarios, azureUsdPorHora } = inglesConfig();
  const hoy = diaPacifico(new Date());
  const claves: string[] = [];
  for (let i = numDias - 1; i >= 0; i--) {
    // Mediodía UTC evita saltos de día por el horario de verano.
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    claves.push(d.toISOString().slice(0, 10));
  }
  const desdeDia = claves[0];
  const desdeIso = new Date(new Date(`${desdeDia}T00:00:00Z`).getTime() - 86_400_000).toISOString();

  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
  const excluir = new Set(((admins ?? []) as { id: string }[]).map((a) => a.id));

  const [intentos, intentosPrueba, vozDias, usoDias, encuestas] = await Promise.all([
    todas<{ created_at: string; user_id: string; origen: "modo" | "chat"; duracion_seg: number | null }>((a, b) =>
      supabase
        .from("english_pron_intentos")
        .select("created_at, user_id, origen, duracion_seg")
        .gte("created_at", desdeIso)
        .order("created_at")
        .range(a, b),
    ),
    todas<{ created_at: string; duracion_seg: number | null }>((a, b) =>
      supabase
        .from("english_prueba_voz_intentos")
        .select("created_at, duracion_seg")
        .gte("created_at", desdeIso)
        .order("created_at")
        .range(a, b),
    ),
    // Todo el historial: límite de voz en el rango y días de uso de cada persona.
    todas<{ dia: string; user_id: string; usados: number }>((a, b) =>
      supabase.from("english_voz_diario").select("dia, user_id, usados").gt("usados", 0).order("dia").range(a, b),
    ),
    todas<{ dia: string; user_id: string }>((a, b) =>
      supabase.from("english_uso_diario").select("dia, user_id").gt("usados", 0).order("dia").range(a, b),
    ),
    todas<{ user_id: string; tipo: EncuestaTipo; respuesta: EncuestaRespuesta }>((a, b) =>
      supabase.from("english_encuestas").select("user_id, tipo, respuesta").order("updated_at").range(a, b),
    ),
  ]);

  const porDia = new Map<string, DiaVoz & { _segundos: number }>(
    claves.map((dia) => [dia, { dia, chat: 0, modo: 0, prueba: 0, alLimite: 0, costoAzureUsd: 0, _segundos: 0 }]),
  );
  for (const i of intentos) {
    const d = porDia.get(diaPacifico(i.created_at));
    if (!d || excluir.has(i.user_id)) continue;
    if (i.origen === "chat") d.chat++;
    else d.modo++;
    d._segundos += Number(i.duracion_seg ?? SEGUNDOS_SIN_DATO);
  }
  for (const i of intentosPrueba) {
    const d = porDia.get(diaPacifico(i.created_at));
    if (!d) continue;
    d.prueba++;
    d._segundos += Number(i.duracion_seg ?? SEGUNDOS_SIN_DATO);
  }

  // Límite de voz: usó todos los intentos gratis del día.
  const limitePorPersona = new Map<string, { dias: number; ultimo: string }>();
  for (const v of vozDias) {
    const d = porDia.get(v.dia);
    if (!d || excluir.has(v.user_id) || v.usados < vozGratisDiarios) continue;
    d.alLimite++;
    const p = limitePorPersona.get(v.user_id) ?? { dias: 0, ultimo: "" };
    p.dias++;
    if (v.dia > p.ultimo) p.ultimo = v.dia;
    limitePorPersona.set(v.user_id, p);
  }

  // Días distintos que cada persona usó la tutora (mensajes o voz).
  const diasUso = new Map<string, Set<string>>();
  for (const x of [...usoDias, ...vozDias]) {
    const s = diasUso.get(x.user_id) ?? new Set<string>();
    s.add(x.dia);
    diasUso.set(x.user_id, s);
  }

  const encuestasValidas = encuestas.filter((e) => !excluir.has(e.user_id));
  const resumen: ResumenEncuesta[] = (["voz", "mensajes"] as EncuestaTipo[]).map((tipo) => {
    const respuestas: Record<EncuestaRespuesta, number> = { no: 0, "3": 0, "5": 0, "10": 0 };
    for (const e of encuestasValidas) if (e.tipo === tipo) respuestas[e.respuesta]++;
    return { tipo, respuestas, total: Object.values(respuestas).reduce((a, b) => a + b, 0) };
  });
  const siPagarian = encuestasValidas.filter((e) => e.respuesta !== "no");

  // Nombres solo de quienes aparecen en las listas.
  const ids = [...new Set([...limitePorPersona.keys(), ...siPagarian.map((e) => e.user_id)])];
  const nombres = new Map<string, string>();
  if (ids.length) {
    const { data: perfiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    for (const p of (perfiles ?? []) as { id: string; display_name: string }[]) nombres.set(p.id, p.display_name);
  }

  const dias: DiaVoz[] = [...porDia.values()].map(({ _segundos, ...d }) => ({
    ...d,
    costoAzureUsd: redondear((_segundos / 3600) * azureUsdPorHora),
  }));
  const segundosTotales = [...porDia.values()].reduce((s, d) => s + d._segundos, 0);

  return {
    dias,
    totales: {
      chat: dias.reduce((s, d) => s + d.chat, 0),
      modo: dias.reduce((s, d) => s + d.modo, 0),
      prueba: dias.reduce((s, d) => s + d.prueba, 0),
      costoAzureUsd: redondear((segundosTotales / 3600) * azureUsdPorHora),
    },
    alLimite: [...limitePorPersona.entries()]
      .map(([id, p]) => ({ nombre: nombres.get(id) ?? "Usuario", diasAlLimite: p.dias, ultimoDia: p.ultimo }))
      .sort((a, b) => b.diasAlLimite - a.diasAlLimite || b.ultimoDia.localeCompare(a.ultimoDia)),
    encuestas: resumen,
    pagarian: siPagarian
      .map((e) => ({
        nombre: nombres.get(e.user_id) ?? "Usuario",
        tipo: e.tipo,
        respuesta: e.respuesta as PersonaQuePagaria["respuesta"],
        diasUso: diasUso.get(e.user_id)?.size ?? 0,
      }))
      .sort((a, b) => Number(b.respuesta) - Number(a.respuesta) || b.diasUso - a.diasUso),
  };
}
