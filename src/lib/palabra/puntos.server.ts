// src/lib/palabra/puntos.server.ts
//
// Panel "Ver puntos" de la Palabra del Día y tarjeta de TikTok. Todo se
// calcula aquí, con service role, desde palabra_partidas: solo cuentan las
// partidas que evaluó el servidor (origen 'servidor', igual que los
// rankings SQL), así que nadie puede inflar sus puntos desde el navegador.
// De cada perfil solo salen nombre y foto (regla de 0076); nunca el
// user_id, el correo, la palabra ni las letras de los intentos.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { rachaEfectiva, sumarDias } from "./logica";
import { NOMBRE_SIN_PERMISO, puntosDe, vioPista } from "./puntos";
import { getPalabraPorFecha, revelar } from "./servidor";
import type {
  PalabraFilaRankingIglesia,
  PalabraPanelPuntos,
  PalabraPuntosHoyFila,
  PalabraPuntosRachaFila,
  PalabraPuntosSemanaFila,
  PalabraTarjetaTikTok,
} from "@/types";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/** Filas que se muestran por pestaña; quien quede fuera ve su lugar abajo. */
const LIMITE = 10;

interface Partida {
  user_id: string;
  fecha: string;
  num_intentos: number;
  resuelta: boolean;
  pista_usada: boolean;
  updated_at: string;
}

interface Perfil {
  nombre: string;
  avatar: string | null;
  tiktok: boolean;
}

async function partidasEntre(service: ServiceClient, desde: string, hasta: string): Promise<Partida[]> {
  const { data, error } = await service
    .from("palabra_partidas")
    .select("user_id, fecha, num_intentos, resuelta, pista_usada, updated_at")
    .eq("origen", "servidor")
    .eq("terminada", true)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  if (error) throw new Error(error.message);
  return (data ?? []) as Partida[];
}

/**
 * Nombre, foto y permiso de TikTok. Si la columna tiktok_permiso todavía no
 * existe (migración 0078 sin aplicar), nadie cuenta como con permiso.
 */
async function perfiles(service: ServiceClient, ids: string[]): Promise<Map<string, Perfil>> {
  const mapa = new Map<string, Perfil>();
  if (ids.length === 0) return mapa;
  const conPermiso = await service
    .from("profiles")
    .select("id, display_name, avatar_url, tiktok_permiso")
    .in("id", ids);
  let filas = conPermiso.data as Array<Record<string, unknown>> | null;
  if (conPermiso.error) {
    const sinPermiso = await service.from("profiles").select("id, display_name, avatar_url").in("id", ids);
    if (sinPermiso.error) throw new Error(sinPermiso.error.message);
    filas = sinPermiso.data as Array<Record<string, unknown>>;
  }
  for (const p of filas ?? []) {
    mapa.set(p.id as string, {
      nombre: ((p.display_name as string | null) ?? "").trim() || "Jugador",
      avatar: (p.avatar_url as string | null) ?? null,
      tiktok: p.tiktok_permiso === true,
    });
  }
  return mapa;
}

/** Quien resolvió la palabra del día, por puntos; en empate, quien terminó primero. */
function ordenarDia(partidas: Partida[], fecha: string) {
  return partidas
    .filter((p) => p.fecha === fecha && p.resuelta)
    .sort((a, b) => puntosDe(b.num_intentos, true) - puntosDe(a.num_intentos, true) || a.updated_at.localeCompare(b.updated_at));
}

interface Suma {
  user_id: string;
  puntos: number;
  dias: number;
  /** Para desempatar: quien llegó primero a esos puntos. */
  ultima: string;
}

function sumarSemana(partidas: Partida[]): Suma[] {
  const sumas = new Map<string, Suma>();
  for (const p of partidas) {
    const s = sumas.get(p.user_id) ?? { user_id: p.user_id, puntos: 0, dias: 0, ultima: "" };
    s.puntos += puntosDe(p.num_intentos, p.resuelta);
    s.dias += 1;
    if (p.resuelta && p.updated_at > s.ultima) s.ultima = p.updated_at;
    sumas.set(p.user_id, s);
  }
  return [...sumas.values()]
    .filter((s) => s.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || b.dias - a.dias || a.ultima.localeCompare(b.ultima));
}

async function rachasDe(service: ServiceClient, ids: string[], hoy: string): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (ids.length === 0) return mapa;
  const { data } = await service
    .from("palabra_rachas")
    .select("user_id, actual, maxima, comodines, ultima_fecha")
    .in("user_id", ids);
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const { racha } = rachaEfectiva(
      {
        actual: r.actual as number,
        maxima: r.maxima as number,
        comodines: r.comodines as number,
        ultimaFecha: (r.ultima_fecha as string | null) ?? null,
      },
      hoy
    );
    mapa.set(r.user_id as string, racha.actual);
  }
  return mapa;
}

/** Corta la lista y deja aparte el lugar de quien mira si quedó fuera. */
function cortar<T extends { esYo: boolean }>(filas: T[]): { filas: T[]; yo: T | null; total: number } {
  const visibles = filas.slice(0, LIMITE);
  const yo = visibles.some((f) => f.esYo) ? null : (filas.find((f) => f.esYo) ?? null);
  return { filas: visibles, yo, total: filas.length };
}

export async function getPanelPuntos(hoy: string, userId: string | null): Promise<PalabraPanelPuntos> {
  const service = await createServiceClient();
  const desde = sumarDias(hoy, -6);
  const partidas = await partidasEntre(service, desde, hoy);

  const dia = ordenarDia(partidas, hoy);
  const semana = sumarSemana(partidas);
  const ids = [...new Set([...dia.map((p) => p.user_id), ...semana.map((s) => s.user_id)])];

  const [mapaPerfiles, rachas, rachasTop, iglesias] = await Promise.all([
    perfiles(service, ids),
    rachasDe(service, semana.map((s) => s.user_id), hoy),
    service.rpc("palabra_ranking_rachas", { p_hoy: hoy, p_limite: LIMITE }),
    // Misma ventana de 7 días que la pestaña de puntos (la función suma p_inicio … p_inicio + 6).
    service.rpc("palabra_ranking_iglesias", { p_inicio: desde, p_limite: LIMITE }),
  ]);
  if (rachasTop.error) console.error("[palabra] rachas:", rachasTop.error.message);
  if (iglesias.error) console.error("[palabra] iglesias:", iglesias.error.message);

  const persona = (id: string, posicion: number) => {
    const p = mapaPerfiles.get(id);
    return { posicion, nombre: p?.nombre ?? "Jugador", avatar: p?.avatar ?? null, esYo: id === userId };
  };

  const filasDia: PalabraPuntosHoyFila[] = dia.map((p, i) => ({
    ...persona(p.user_id, i + 1),
    intentos: p.num_intentos,
    pista: vioPista(p.fecha, p.num_intentos, p.resuelta, p.pista_usada),
    puntos: puntosDe(p.num_intentos, true),
  }));
  const filasSemana: PalabraPuntosSemanaFila[] = semana.map((s, i) => ({
    ...persona(s.user_id, i + 1),
    puntos: s.puntos,
    dias: s.dias,
    racha: rachas.get(s.user_id) ?? 0,
  }));
  const filasRachas: PalabraPuntosRachaFila[] = (
    (rachasTop.data ?? []) as Array<{ user_id: string; nombre: string; avatar_url: string | null; actual: number; maxima: number }>
  ).map((r, i) => ({
    posicion: i + 1,
    nombre: (r.nombre ?? "").trim() || "Jugador",
    avatar: r.avatar_url,
    esYo: r.user_id === userId,
    actual: r.actual,
    maxima: r.maxima,
  }));

  return {
    hoy,
    desde,
    dia: cortar(filasDia),
    semana: cortar(filasSemana),
    rachas: filasRachas,
    iglesias: (iglesias.data ?? []) as PalabraFilaRankingIglesia[],
  };
}

/**
 * Tarjeta de TikTok de un día YA TERMINADO (fecha < hoy; quien llama lo
 * valida). Sin permiso: "Hermano/a participante", sin foto. Nunca iglesia.
 */
export async function getTarjetaTikTok(fecha: string): Promise<PalabraTarjetaTikTok> {
  const service = await createServiceClient();
  const desde = sumarDias(fecha, -6);
  const [partidas, palabra] = await Promise.all([partidasEntre(service, desde, fecha), getPalabraPorFecha(fecha, service)]);

  const dia = ordenarDia(partidas, fecha);
  const semana = sumarSemana(partidas);
  const top3 = dia.slice(0, 3);
  const top5 = semana.slice(0, 5);
  const mapa = await perfiles(service, [...new Set([...top3.map((p) => p.user_id), ...top5.map((s) => s.user_id)])]);

  const persona = (id: string, posicion: number) => {
    const p = mapa.get(id);
    return p?.tiktok
      ? { posicion, nombre: p.nombre, avatar: p.avatar, esYo: false }
      : { posicion, nombre: NOMBRE_SIN_PERMISO, avatar: null, esYo: false };
  };

  return {
    fecha,
    palabra: palabra ? revelar(palabra) : null,
    top3: top3.map((p, i) => ({
      ...persona(p.user_id, i + 1),
      intentos: p.num_intentos,
      pista: vioPista(p.fecha, p.num_intentos, p.resuelta, p.pista_usada),
      puntos: puntosDe(p.num_intentos, true),
    })),
    top5Semana: top5.map((s, i) => ({ ...persona(s.user_id, i + 1), puntos: s.puntos, dias: s.dias, racha: 0 })),
    jugadores: partidas.filter((p) => p.fecha === fecha).length,
  };
}
