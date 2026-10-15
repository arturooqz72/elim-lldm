// src/lib/ingles/estadisticas-enganche.server.ts
// Saludo, botones de respuesta rápida y recordatorio diario de Elim English
// para /admin/ingles. Sin cuentas admin. Solo servidor (service role).
//
// "Usaron la tutora" (estadisticas.server.ts) no cambia: el saludo y lo que
// contestan los botones no pasan por el servidor ni se cobran, así que ahí
// solo cuenta quien escribió o practicó.

import type { SupabaseClient } from "@supabase/supabase-js";
import { diaPacifico, todas } from "./estadisticas.server";
import type { BotonRapido } from "./saludos";

export type RespuestaAviso = "si" | "ahora_no" | "bloqueado" | "apagado";

export interface DiaRecordatorio {
  dia: string;
  enviados: number;
  abiertos: number;
}

export interface EstadisticasEnganche {
  /** Por botón: cuántas veces lo tocaron y cuántas personas distintas. */
  botones: Record<BotonRapido, { toques: number; personas: number }>;
  /** Personas que tocaron al menos un botón. */
  personasConBoton: number;
  /** Personas distintas por respuesta al aviso "¿Quieres que te recuerde…?". */
  aviso: Record<RespuestaAviso, number>;
  /** Personas con el recordatorio activado ahora mismo (sin importar el rango). */
  activasAhora: number;
  dias: DiaRecordatorio[];
  totales: { enviados: number; abiertos: number };
}

const BOTONES: BotonRapido[] = ["pronunciacion", "platicar", "reto", "principiante"];
const RESPUESTAS: RespuestaAviso[] = ["si", "ahora_no", "bloqueado", "apagado"];

export async function leerEstadisticasEnganche(supabase: SupabaseClient, numDias: number): Promise<EstadisticasEnganche> {
  const hoy = diaPacifico(new Date());
  const claves: string[] = [];
  for (let i = numDias - 1; i >= 0; i--) {
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    claves.push(d.toISOString().slice(0, 10));
  }
  const desdeDia = claves[0];
  const desdeIso = new Date(new Date(`${desdeDia}T00:00:00Z`).getTime() - 86_400_000).toISOString();

  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
  const excluir = new Set(((admins ?? []) as { id: string }[]).map((a) => a.id));

  const [eventos, envios, suscripciones] = await Promise.all([
    todas<{ created_at: string; user_id: string | null; visitante_id: string | null; tipo: string; valor: string }>((a, b) =>
      supabase
        .from("english_eventos")
        .select("created_at, user_id, visitante_id, tipo, valor")
        .gte("created_at", desdeIso)
        .order("created_at")
        .range(a, b),
    ),
    todas<{ dia: string; user_id: string; abierto_at: string | null }>((a, b) =>
      supabase.from("english_push_envios").select("dia, user_id, abierto_at").gte("dia", desdeDia).order("dia").range(a, b),
    ),
    todas<{ user_id: string }>((a, b) => supabase.from("english_push_suscripciones").select("user_id").range(a, b)),
  ]);

  const botones = Object.fromEntries(BOTONES.map((b) => [b, { toques: 0, personas: 0 }])) as EstadisticasEnganche["botones"];
  const personasBoton = Object.fromEntries(BOTONES.map((b) => [b, new Set<string>()])) as Record<BotonRapido, Set<string>>;
  const conBoton = new Set<string>();
  const personasAviso = Object.fromEntries(RESPUESTAS.map((r) => [r, new Set<string>()])) as Record<RespuestaAviso, Set<string>>;

  for (const e of eventos) {
    if (e.user_id && excluir.has(e.user_id)) continue;
    if (diaPacifico(e.created_at) < desdeDia) continue;
    const quien = e.user_id ?? `v:${e.visitante_id}`;
    if (e.tipo === "boton_rapido" && e.valor in botones) {
      const b = e.valor as BotonRapido;
      botones[b].toques++;
      personasBoton[b].add(quien);
      conBoton.add(quien);
    } else if (e.tipo === "aviso_push" && e.valor in personasAviso) {
      personasAviso[e.valor as RespuestaAviso].add(quien);
    }
  }
  for (const b of BOTONES) botones[b].personas = personasBoton[b].size;

  const porDia = new Map(claves.map((dia) => [dia, { dia, enviados: 0, abiertos: 0 }]));
  for (const e of envios) {
    if (excluir.has(e.user_id)) continue;
    const d = porDia.get(e.dia);
    if (!d) continue;
    d.enviados++;
    if (e.abierto_at) d.abiertos++;
  }
  const dias = [...porDia.values()];

  return {
    botones,
    personasConBoton: conBoton.size,
    aviso: Object.fromEntries(RESPUESTAS.map((r) => [r, personasAviso[r].size])) as Record<RespuestaAviso, number>,
    activasAhora: new Set(suscripciones.map((s) => s.user_id).filter((id) => !excluir.has(id))).size,
    dias,
    totales: {
      enviados: dias.reduce((n, d) => n + d.enviados, 0),
      abiertos: dias.reduce((n, d) => n + d.abiertos, 0),
    },
  };
}
