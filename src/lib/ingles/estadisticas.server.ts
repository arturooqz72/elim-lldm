// src/lib/ingles/estadisticas.server.ts
// Números de uso de Elim English para /admin/ingles, agrupados por día en
// hora del Pacífico. Se excluyen las cuentas admin para que las pruebas no
// inflen los datos. Solo servidor (service role).

import type { SupabaseClient } from "@supabase/supabase-js";
import { HISTORIAL_TZ } from "@/lib/historial";
import { ETIQUETA_MODO } from "./etiquetas";
import { inglesConfig } from "./config";
import type { InglesModo } from "@/types";

/**
 * Costo aproximado de Anthropic por llamada (Haiku, ~1.5k tokens de entrada
 * y ~300 de salida). Solo orientativo: el costo real está en la consola de
 * Anthropic.
 */
const COSTO_APROX_POR_LLAMADA_USD = 0.003;
const PAGINA = 1000;

export interface DiaIngles {
  dia: string;
  personasVisitaron: number;
  usuariosActivos: number;
  mensajes: number;
  llegaronAlLimite: number;
  intentosPronunciacion: number;
  nuevosEnLista: number;
}

export interface EstadisticasIngles {
  dias: DiaIngles[];
  totales: Omit<DiaIngles, "dia"> & { costoAproxUsd: number; listaEsperaTotal: number };
  modos: { modo: string; mensajes: number }[];
}

/** "YYYY-MM-DD" de un instante en hora del Pacífico. */
function diaPacifico(fecha: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HISTORIAL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(fecha));
}

/** Supabase devuelve máximo 1000 filas por consulta: se pide por páginas. */
async function todas<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown }>): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data } = await consulta(desde, desde + PAGINA - 1);
    const pagina = (data ?? []) as T[];
    filas.push(...pagina);
    if (pagina.length < PAGINA) return filas;
  }
}

export async function leerEstadisticas(supabase: SupabaseClient, numDias: number): Promise<EstadisticasIngles> {
  const hoy = diaPacifico(new Date());
  const claves: string[] = [];
  for (let i = numDias - 1; i >= 0; i--) {
    // Mediodía UTC evita saltos de día por el horario de verano.
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    claves.push(d.toISOString().slice(0, 10));
  }
  const desdeDia = claves[0];
  // Un día de margen hacia atrás; luego se filtra por día del Pacífico.
  const desdeIso = new Date(new Date(`${desdeDia}T00:00:00Z`).getTime() - 86_400_000).toISOString();

  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
  const excluir = new Set(((admins ?? []) as { id: string }[]).map((a) => a.id));
  const valido = (id: string | null) => !id || !excluir.has(id);

  const [visitas, uso, mensajes, intentos, lista] = await Promise.all([
    todas<{ created_at: string; profile_id: string | null; visitante_id: string | null }>((a, b) =>
      supabase
        .from("visitas_sitio")
        .select("created_at, profile_id, visitante_id")
        .like("ruta", "/ingles%")
        .gte("created_at", desdeIso)
        .order("created_at")
        .range(a, b),
    ),
    todas<{ dia: string; user_id: string; usados: number }>((a, b) =>
      supabase.from("english_uso_diario").select("dia, user_id, usados").gte("dia", desdeDia).order("dia").range(a, b),
    ),
    todas<{ created_at: string; user_id: string; modo: InglesModo }>((a, b) =>
      supabase
        .from("english_mensajes")
        .select("created_at, user_id, modo")
        .eq("role", "user")
        .gte("created_at", desdeIso)
        .order("created_at")
        .range(a, b),
    ),
    todas<{ created_at: string; user_id: string }>((a, b) =>
      supabase
        .from("english_pron_intentos")
        .select("created_at, user_id")
        .gte("created_at", desdeIso)
        .order("created_at")
        .range(a, b),
    ),
    todas<{ created_at: string; user_id: string }>((a, b) =>
      supabase.from("english_lista_espera").select("created_at, user_id").order("created_at").range(a, b),
    ),
  ]);

  const { gratisDiarios } = inglesConfig();
  const porDia = new Map<string, DiaIngles & { _personas: Set<string>; _activos: Set<string> }>(
    claves.map((dia) => [
      dia,
      {
        dia,
        personasVisitaron: 0,
        usuariosActivos: 0,
        mensajes: 0,
        llegaronAlLimite: 0,
        intentosPronunciacion: 0,
        nuevosEnLista: 0,
        _personas: new Set<string>(),
        _activos: new Set<string>(),
      },
    ]),
  );
  const personasRango = new Set<string>();
  const activosRango = new Set<string>();
  const modos = new Map<string, number>();

  for (const v of visitas) {
    const d = porDia.get(diaPacifico(v.created_at));
    const quien = v.profile_id ?? v.visitante_id;
    if (!d || !quien || !valido(v.profile_id)) continue;
    d._personas.add(quien);
    personasRango.add(quien);
  }
  for (const u of uso) {
    const d = porDia.get(u.dia);
    if (!d || !valido(u.user_id) || u.usados <= 0) continue;
    d._activos.add(u.user_id);
    activosRango.add(u.user_id);
    if (u.usados >= gratisDiarios) d.llegaronAlLimite++;
  }
  for (const m of mensajes) {
    const d = porDia.get(diaPacifico(m.created_at));
    if (!d || !valido(m.user_id)) continue;
    d.mensajes++;
    const etiqueta = ETIQUETA_MODO[m.modo] ?? m.modo;
    modos.set(etiqueta, (modos.get(etiqueta) ?? 0) + 1);
  }
  for (const i of intentos) {
    const d = porDia.get(diaPacifico(i.created_at));
    if (d && valido(i.user_id)) d.intentosPronunciacion++;
  }
  for (const l of lista) {
    const d = porDia.get(diaPacifico(l.created_at));
    if (d && valido(l.user_id)) d.nuevosEnLista++;
  }

  const dias: DiaIngles[] = [...porDia.values()].map(({ _personas, _activos, ...d }) => ({
    ...d,
    personasVisitaron: _personas.size,
    usuariosActivos: _activos.size,
  }));

  const suma = (k: keyof Omit<DiaIngles, "dia">) => dias.reduce((s, d) => s + d[k], 0);
  const llamadas = suma("mensajes") + suma("intentosPronunciacion");

  return {
    dias,
    totales: {
      personasVisitaron: personasRango.size,
      usuariosActivos: activosRango.size,
      mensajes: suma("mensajes"),
      llegaronAlLimite: suma("llegaronAlLimite"),
      intentosPronunciacion: suma("intentosPronunciacion"),
      nuevosEnLista: suma("nuevosEnLista"),
      listaEsperaTotal: lista.filter((l) => valido(l.user_id)).length,
      costoAproxUsd: Math.round(llamadas * COSTO_APROX_POR_LLAMADA_USD * 100) / 100,
    },
    modos: [...modos.entries()].map(([modo, n]) => ({ modo, mensajes: n })).sort((a, b) => b.mensajes - a.mensajes),
  };
}
