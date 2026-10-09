// src/lib/ingles/estadisticas.server.ts
// Números de uso de Elim English para /admin/ingles, agrupados por día en
// hora del Pacífico. Se excluyen las cuentas admin para que las pruebas no
// inflen los datos. Solo servidor (service role).

import type { SupabaseClient } from "@supabase/supabase-js";
import { HISTORIAL_TZ } from "@/lib/historial";
import { ETIQUETA_MODO } from "./etiquetas";
import { inglesConfig } from "./config";
import { rachaDesdeFechas } from "./retos.server";
import type { InglesModo } from "@/types";

/**
 * Costo aproximado de Anthropic por llamada (Haiku, ~1.5k tokens de entrada
 * y ~300 de salida). Solo orientativo: el costo real está en la consola de
 * Anthropic.
 */
const COSTO_APROX_POR_LLAMADA_USD = 0.003;
/** Duración supuesta de los intentos guardados antes de que se midiera (0062). */
const SEGUNDOS_POR_INTENTO_SIN_DATO = 5;
/** visitas_sitio guarda 90 días (0058): más atrás no hay de dónde leer. */
const DIAS_HISTORIAL_VISITAS = 90;
const PAGINA = 1000;

export interface DiaIngles {
  dia: string;
  personasVisitaron: number;
  usuariosActivos: number;
  /** Usaron la tutora ese día y ya la habían usado otro día antes. */
  regresaron: number;
  /** Abrieron /ingles ese día y ya lo habían abierto otro día antes (aunque no escribieran). */
  volvieronAbrir: number;
  mensajes: number;
  llegaronAlLimite: number;
  intentosPronunciacion: number;
  nuevosEnLista: number;
  /** Veces que se abrió Elim English desde la app instalada (PWA). */
  aperturasApp: number;
  /** Personas que completaron el Reto del día ese día. */
  retosCompletados: number;
}

/** Rachas (días seguidos practicando), de todo el historial, sin admins. */
export interface RachasIngles {
  /** La racha más larga que alguien ha logrado. */
  masLarga: number;
  /** Quién la logró (si hay empate, el primero). */
  nombre: string | null;
  /** La racha más larga que sigue viva hoy. */
  activaMasLarga: number;
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

/** Aperturas desde la app instalada en el rango. */
export interface AppIngles {
  /** Personas distintas (cuenta o navegador anónimo). */
  personas: number;
  ios: number;
  android: number;
  otro: number;
  /** Cuentas distintas que abrieron la app con la sesión iniciada. */
  conSesion: number;
  /** Navegadores distintos que abrieron la app sin sesión. */
  sinSesion: number;
  /** De ellos, en iPhone / en Android (por la plataforma de su primera apertura en el rango). */
  sinSesionIos: number;
  sinSesionAndroid: number;
  /** De los que abrieron sin sesión, cuántos usaron la prueba sin cuenta (desde 0075). */
  sinSesionUsaronPrueba: number;
  /** De los que abrieron sin sesión, cuántos iniciaron sesión después en ese navegador (desde 0075). */
  sinSesionEntraronDespues: number;
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
  app: AppIngles;
  rachas: RachasIngles;
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
  // Para "Volvieron a abrir" se necesitan también las visitas de antes del rango.
  const desdeVisitasIso = new Date(Date.now() - DIAS_HISTORIAL_VISITAS * 86_400_000).toISOString();

  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
  const excluir = new Set(((admins ?? []) as { id: string }[]).map((a) => a.id));
  const valido = (id: string | null) => !id || !excluir.has(id);

  const [visitas, uso, mensajes, intentos, lista, visitantesPrueba, mensajesPrueba, aperturas, retosHechos] =
    await Promise.all([
    todas<{ created_at: string; profile_id: string | null; visitante_id: string | null }>((a, b) =>
      supabase
        .from("visitas_sitio")
        .select("created_at, profile_id, visitante_id")
        .like("ruta", "/ingles%")
        .gte("created_at", desdeVisitasIso)
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
    todas<{ anon_id: string; created_at: string; usados: number; user_id: string | null }>((a, b) =>
      supabase
        .from("english_prueba_visitantes")
        .select("anon_id, created_at, usados, user_id")
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
    // Todo el historial: también cuenta para "Volvieron a abrir".
    todas<{
      created_at: string;
      user_id: string | null;
      visitante_id: string | null;
      prueba_id: string | null;
      plataforma: "ios" | "android" | "otro";
    }>((a, b) =>
      supabase
        .from("english_app_aperturas")
        .select("created_at, user_id, visitante_id, prueba_id, plataforma")
        .order("created_at")
        .range(a, b),
    ),
    // Todo el historial: también sirve para calcular las rachas.
    todas<{ dia: string; user_id: string }>((a, b) =>
      supabase.from("english_retos_completados").select("dia, user_id").order("dia").range(a, b),
    ),
  ]);

  const { gratisDiarios, azureUsdPorHora, rachaMensajesDia } = inglesConfig();
  const porDia = new Map<string, DiaIngles & { _personas: Set<string>; _activos: Set<string> }>(
    claves.map((dia) => [
      dia,
      {
        dia,
        personasVisitaron: 0,
        usuariosActivos: 0,
        regresaron: 0,
        volvieronAbrir: 0,
        mensajes: 0,
        llegaronAlLimite: 0,
        intentosPronunciacion: 0,
        nuevosEnLista: 0,
        aperturasApp: 0,
        retosCompletados: 0,
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
    const etiqueta = (m.modo as string) === "reto" ? "Reto del día" : (ETIQUETA_MODO[m.modo] ?? m.modo);
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

  // Desde 0075 el id del navegador se guarda también con sesión: así una
  // visita sin sesión se une con la cuenta que después entró en ese navegador.
  const cuentaDeNavegador = new Map<string, string>();
  /** Última vez que cada navegador se usó con sesión (para "entró después"). */
  const ultimaConSesion = new Map<string, string>();
  const conCuenta = (navegador: string | null, cuenta: string | null, fecha: string) => {
    if (!navegador || !cuenta) return;
    cuentaDeNavegador.set(navegador, cuenta);
    if (fecha > (ultimaConSesion.get(navegador) ?? "")) ultimaConSesion.set(navegador, fecha);
  };
  for (const v of visitas) conCuenta(v.visitante_id, v.profile_id, v.created_at);
  for (const a of aperturas) conCuenta(a.visitante_id, a.user_id, a.created_at);
  const persona = (cuenta: string | null, navegador: string | null) =>
    cuenta ?? (navegador ? (cuentaDeNavegador.get(navegador) ?? navegador) : null);

  // Volvieron a abrir: días distintos en que cada persona abrió /ingles
  // (visitas en el navegador o aperturas de la app), del historial que haya.
  const diasAbiertos = new Map<string, Set<string>>();
  const abrio = (quien: string | null, fecha: string) => {
    if (!quien || excluir.has(quien)) return;
    const fechas = diasAbiertos.get(quien) ?? new Set<string>();
    fechas.add(diaPacifico(fecha));
    diasAbiertos.set(quien, fechas);
  };
  for (const v of visitas) abrio(persona(v.profile_id, v.visitante_id), v.created_at);
  for (const a of aperturas) abrio(persona(a.user_id, a.visitante_id), a.created_at);
  const volvieronRango = new Set<string>();
  for (const [quien, fechas] of diasAbiertos) {
    const primero = [...fechas].sort()[0];
    for (const dia of fechas) {
      const d = porDia.get(dia);
      if (!d || dia === primero) continue;
      d.volvieronAbrir++;
      volvieronRango.add(quien);
    }
  }

  const app: AppIngles = {
    personas: 0,
    ios: 0,
    android: 0,
    otro: 0,
    conSesion: 0,
    sinSesion: 0,
    sinSesionIos: 0,
    sinSesionAndroid: 0,
    sinSesionUsaronPrueba: 0,
    sinSesionEntraronDespues: 0,
  };
  const personasApp = new Set<string>();
  const cuentasApp = new Set<string>();
  // Navegador sin sesión → su primera apertura en el rango y las pruebas que traía.
  const sinSesionApp = new Map<string, { desde: string; plataforma: "ios" | "android" | "otro"; pruebas: Set<string> }>();
  for (const a of aperturas) {
    const d = porDia.get(diaPacifico(a.created_at));
    const quien = a.user_id ?? a.visitante_id;
    if (!d || !quien || !valido(a.user_id)) continue;
    d.aperturasApp++;
    personasApp.add(quien);
    app[a.plataforma]++;
    if (a.user_id) {
      cuentasApp.add(a.user_id);
    } else if (a.visitante_id) {
      const info = sinSesionApp.get(a.visitante_id) ?? {
        desde: a.created_at,
        plataforma: a.plataforma,
        pruebas: new Set<string>(),
      };
      if (a.prueba_id) info.pruebas.add(a.prueba_id);
      sinSesionApp.set(a.visitante_id, info);
    }
  }
  app.personas = personasApp.size;
  app.conSesion = cuentasApp.size;

  // De quienes abrieron sin sesión: ¿usaron la prueba? ¿entraron después con su cuenta?
  const pruebaPorId = new Map(visitantesPrueba.map((p) => [p.anon_id, p]));
  const entroDespues = (navegador: string, desde: string) => (ultimaConSesion.get(navegador) ?? "") > desde;
  for (const [navegador, info] of sinSesionApp) {
    const cuenta = cuentaDeNavegador.get(navegador);
    if (cuenta && excluir.has(cuenta)) continue;
    app.sinSesion++;
    if (info.plataforma === "ios") app.sinSesionIos++;
    else if (info.plataforma === "android") app.sinSesionAndroid++;
    const pruebas = [...info.pruebas].flatMap((id) => pruebaPorId.get(id) ?? []);
    if (pruebas.length) app.sinSesionUsaronPrueba++;
    if (entroDespues(navegador, info.desde) || pruebas.some((p) => p.user_id)) app.sinSesionEntraronDespues++;
  }

  for (const r of retosHechos) {
    const d = porDia.get(r.dia);
    if (d && valido(r.user_id)) d.retosCompletados++;
  }

  // Rachas: días con el reto completado o con 3+ mensajes, por persona
  // (misma lógica que la racha que ve cada usuario en /ingles).
  const diasRacha = new Map<string, string[]>();
  const sumarDia = (id: string, dia: string) => {
    if (!valido(id)) return;
    const lista = diasRacha.get(id) ?? [];
    lista.push(dia);
    diasRacha.set(id, lista);
  };
  for (const u of uso) if (u.usados >= rachaMensajesDia) sumarDia(u.user_id, u.dia);
  for (const r of retosHechos) sumarDia(r.user_id, r.dia);
  const rachas: RachasIngles = { masLarga: 0, nombre: null, activaMasLarga: 0 };
  let idMasLarga: string | null = null;
  for (const [id, fechas] of diasRacha) {
    const r = rachaDesdeFechas(fechas, hoy);
    if (r.maxima > rachas.masLarga) {
      rachas.masLarga = r.maxima;
      idMasLarga = id;
    }
    rachas.activaMasLarga = Math.max(rachas.activaMasLarga, r.actual);
  }
  if (idMasLarga) {
    const { data: p } = await supabase.from("profiles").select("display_name").eq("id", idMasLarga).maybeSingle();
    rachas.nombre = (p as { display_name: string } | null)?.display_name ?? "Usuario";
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
      volvieronAbrir: volvieronRango.size,
      mensajes: suma("mensajes"),
      llegaronAlLimite: suma("llegaronAlLimite"),
      intentosPronunciacion: suma("intentosPronunciacion"),
      nuevosEnLista: suma("nuevosEnLista"),
      aperturasApp: suma("aperturasApp"),
      retosCompletados: suma("retosCompletados"),
      listaEsperaTotal: lista.filter((l) => valido(l.user_id)).length,
      costoAproxUsd: Math.round(llamadas * COSTO_APROX_POR_LLAMADA_USD * 100) / 100,
      costoAzureUsd: Math.round((segundosAzure / 3600) * azureUsdPorHora * 100) / 100,
      minutosAzure: Math.round((segundosAzure / 60) * 10) / 10,
    },
    app,
    rachas,
    prueba: {
      visitantes: pruebasRango.length,
      crearonCuenta,
      yaTeniaCuenta,
      mensajes: mensajesDePrueba,
    },
    modos: [...modos.entries()].map(([modo, n]) => ({ modo, mensajes: n })).sort((a, b) => b.mensajes - a.mensajes),
  };
}
