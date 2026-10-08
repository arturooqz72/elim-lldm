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
/** Duración supuesta de los intentos guardados antes de que se midiera (0062). */
const SEGUNDOS_POR_INTENTO_SIN_DATO = 5;
const PAGINA = 1000;

export interface DiaIngles {
  dia: string;
  personasVisitaron: number;
  usuariosActivos: number;
  /** Usaron la tutora ese día y ya la habían usado otro día antes. */
  regresaron: number;
  mensajes: number;
  llegaronAlLimite: number;
  intentosPronunciacion: number;
  nuevosEnLista: number;
}

/** Persona que llegó al límite diario al menos una vez en el rango. */
export interface PersonaAlLimite {
  nombre: string;
  /** Días del rango en que usó todos sus mensajes gratis. */
  diasAlLimite: number;
  /** Días del rango en que usó la tutora (aunque no llegara al límite). */
  diasActivos: number;
  /** Mensajes usados en el rango (chat + pronunciación). */
  mensajes: number;
  ultimoDiaAlLimite: string;
  enListaEspera: boolean;
}

/** Prueba sin cuenta en el rango. */
export interface PruebaIngles {
  /** Visitantes que mandaron al menos un mensaje de prueba. */
  visitantes: number;
  /** De ellos, cuántos crearon una cuenta nueva después de probar. */
  crearonCuenta: number;
  /** De ellos, cuántos entraron con una cuenta que ya tenían. */
  yaTeniaCuenta: number;
  /** Mensajes de prueba (cuentan en el costo de Anthropic). */
  mensajes: number;
}

export interface EstadisticasIngles {
  dias: DiaIngles[];
  totales: Omit<DiaIngles, "dia"> & {
    costoAproxUsd: number;
    costoAzureUsd: number;
    minutosAzure: number;
    listaEsperaTotal: number;
  };
  prueba: PruebaIngles;
  modos: { modo: string; mensajes: number }[];
  alLimite: PersonaAlLimite[];
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

  const [visitas, uso, mensajes, intentos, lista, visitantesPrueba, mensajesPrueba] = await Promise.all([
    todas<{ created_at: string; profile_id: string | null; visitante_id: string | null }>((a, b) =>
      supabase
        .from("visitas_sitio")
        .select("created_at, profile_id, visitante_id")
        .like("ruta", "/ingles%")
        .gte("created_at", desdeIso)
        .order("created_at")
        .range(a, b),
    ),
    // Todo el historial (no solo el rango) para saber si alguien "regresó".
    todas<{ dia: string; user_id: string; usados: number }>((a, b) =>
      supabase.from("english_uso_diario").select("dia, user_id, usados").gt("usados", 0).order("dia").range(a, b),
    ),
    todas<{ created_at: string; user_id: string; modo: InglesModo; de_prueba: boolean }>((a, b) =>
      supabase
        .from("english_mensajes")
        .select("created_at, user_id, modo, de_prueba")
        .eq("role", "user")
        .gte("created_at", desdeIso)
        .order("created_at")
        .range(a, b),
    ),
    todas<{ created_at: string; user_id: string; duracion_seg: number | null }>((a, b) =>
      supabase
        .from("english_pron_intentos")
        .select("created_at, user_id, duracion_seg")
        .gte("created_at", desdeIso)
        .order("created_at")
        .range(a, b),
    ),
    todas<{ created_at: string; user_id: string }>((a, b) =>
      supabase.from("english_lista_espera").select("created_at, user_id").order("created_at").range(a, b),
    ),
    // Todas las pruebas: la de un usuario cuenta como su primer uso.
    todas<{ created_at: string; usados: number; user_id: string | null }>((a, b) =>
      supabase
        .from("english_prueba_visitantes")
        .select("created_at, usados, user_id")
        .gt("usados", 0)
        .order("created_at")
        .range(a, b),
    ),
    // Mensajes de prueba que todavía no pasan a una cuenta (los que ya
    // pasaron están en english_mensajes con de_prueba = true).
    todas<{ created_at: string }>((a, b) =>
      supabase
        .from("english_prueba_mensajes")
        .select("created_at")
        .eq("role", "user")
        .gte("created_at", desdeIso)
        .order("created_at")
        .range(a, b),
    ),
  ]);

  const { gratisDiarios, azureUsdPorHora } = inglesConfig();
  const porDia = new Map<string, DiaIngles & { _personas: Set<string>; _activos: Set<string> }>(
    claves.map((dia) => [
      dia,
      {
        dia,
        personasVisitaron: 0,
        usuariosActivos: 0,
        regresaron: 0,
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
  const regresaronRango = new Set<string>();
  const modos = new Map<string, number>();

  for (const v of visitas) {
    const d = porDia.get(diaPacifico(v.created_at));
    const quien = v.profile_id ?? v.visitante_id;
    if (!d || !quien || !valido(v.profile_id)) continue;
    d._personas.add(quien);
    personasRango.add(quien);
  }

  // Primer día en que cada persona usó la tutora (con cuenta o en la prueba).
  const primerDia = new Map<string, string>();
  const marcarPrimero = (id: string, dia: string) => {
    const antes = primerDia.get(id);
    if (!antes || dia < antes) primerDia.set(id, dia);
  };
  for (const u of uso) marcarPrimero(u.user_id, u.dia);
  for (const p of visitantesPrueba) if (p.user_id) marcarPrimero(p.user_id, diaPacifico(p.created_at));

  const porPersona = new Map<string, { diasAlLimite: number; diasActivos: number; mensajes: number; ultimo: string }>();
  for (const u of uso) {
    const d = porDia.get(u.dia);
    if (!d || !valido(u.user_id)) continue;
    d._activos.add(u.user_id);
    activosRango.add(u.user_id);
    if ((primerDia.get(u.user_id) ?? u.dia) < u.dia) {
      d.regresaron++;
      regresaronRango.add(u.user_id);
    }
    const per = porPersona.get(u.user_id) ?? { diasAlLimite: 0, diasActivos: 0, mensajes: 0, ultimo: "" };
    per.diasActivos++;
    per.mensajes += u.usados;
    if (u.usados >= gratisDiarios) {
      d.llegaronAlLimite++;
      per.diasAlLimite++;
      if (u.dia > per.ultimo) per.ultimo = u.dia;
    }
    porPersona.set(u.user_id, per);
  }

  let mensajesDePrueba = 0;
  for (const m of mensajes) {
    const d = porDia.get(diaPacifico(m.created_at));
    if (!d || !valido(m.user_id)) continue;
    if (m.de_prueba) {
      mensajesDePrueba++;
      continue;
    }
    d.mensajes++;
    const etiqueta = ETIQUETA_MODO[m.modo] ?? m.modo;
    modos.set(etiqueta, (modos.get(etiqueta) ?? 0) + 1);
  }
  for (const m of mensajesPrueba) if (porDia.has(diaPacifico(m.created_at))) mensajesDePrueba++;

  let segundosAzure = 0;
  for (const i of intentos) {
    const d = porDia.get(diaPacifico(i.created_at));
    if (!d || !valido(i.user_id)) continue;
    d.intentosPronunciacion++;
    segundosAzure += Number(i.duracion_seg ?? SEGUNDOS_POR_INTENTO_SIN_DATO);
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
  const llamadas = suma("mensajes") + suma("intentosPronunciacion") + mensajesDePrueba;

  // Prueba sin cuenta: visitantes cuya prueba empezó en el rango. "Creó
  // cuenta" = la cuenta que recibió la conversación es más nueva que la prueba.
  const pruebasRango = visitantesPrueba.filter((p) => diaPacifico(p.created_at) >= desdeDia && valido(p.user_id));
  const idsConvertidos = [...new Set(pruebasRango.flatMap((p) => (p.user_id ? [p.user_id] : [])))];
  const creadaEn = new Map<string, string>();
  if (idsConvertidos.length) {
    const { data: perfiles } = await supabase.from("profiles").select("id, created_at").in("id", idsConvertidos);
    for (const p of (perfiles ?? []) as { id: string; created_at: string }[]) creadaEn.set(p.id, p.created_at);
  }
  let crearonCuenta = 0;
  let yaTeniaCuenta = 0;
  for (const p of pruebasRango) {
    if (!p.user_id) continue;
    const creada = creadaEn.get(p.user_id);
    if (creada && new Date(creada) >= new Date(p.created_at)) crearonCuenta++;
    else yaTeniaCuenta++;
  }

  // Quiénes llegaron al límite (nombres solo de esas personas).
  const idsAlLimite = [...porPersona.entries()].filter(([, p]) => p.diasAlLimite > 0).map(([id]) => id);
  const nombres = new Map<string, string>();
  if (idsAlLimite.length) {
    const { data: perfiles } = await supabase.from("profiles").select("id, display_name").in("id", idsAlLimite);
    for (const p of (perfiles ?? []) as { id: string; display_name: string }[]) nombres.set(p.id, p.display_name);
  }
  const enLista = new Set(lista.map((l) => l.user_id));
  const alLimite: PersonaAlLimite[] = idsAlLimite
    .map((id) => {
      const p = porPersona.get(id)!;
      return {
        nombre: nombres.get(id) ?? "Usuario",
        diasAlLimite: p.diasAlLimite,
        diasActivos: p.diasActivos,
        mensajes: p.mensajes,
        ultimoDiaAlLimite: p.ultimo,
        enListaEspera: enLista.has(id),
      };
    })
    .sort((a, b) => b.diasAlLimite - a.diasAlLimite || b.mensajes - a.mensajes);

  return {
    alLimite,
    dias,
    totales: {
      personasVisitaron: personasRango.size,
      usuariosActivos: activosRango.size,
      regresaron: regresaronRango.size,
      mensajes: suma("mensajes"),
      llegaronAlLimite: suma("llegaronAlLimite"),
      intentosPronunciacion: suma("intentosPronunciacion"),
      nuevosEnLista: suma("nuevosEnLista"),
      listaEsperaTotal: lista.filter((l) => valido(l.user_id)).length,
      costoAproxUsd: Math.round(llamadas * COSTO_APROX_POR_LLAMADA_USD * 100) / 100,
      costoAzureUsd: Math.round((segundosAzure / 3600) * azureUsdPorHora * 100) / 100,
      minutosAzure: Math.round((segundosAzure / 60) * 10) / 10,
    },
    prueba: {
      visitantes: pruebasRango.length,
      crearonCuenta,
      yaTeniaCuenta,
      mensajes: mensajesDePrueba,
    },
    modos: [...modos.entries()].map(([modo, n]) => ({ modo, mensajes: n })).sort((a, b) => b.mensajes - a.mensajes),
  };
}
