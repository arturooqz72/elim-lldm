// src/lib/palabra/puntos.server.ts
//
// Panel "Ver puntos" de la Palabra del Día y tarjeta de TikTok. Todo se
// calcula aquí, con service role, desde palabra_partidas: solo cuentan las
// partidas que evaluó el servidor (origen 'servidor', igual que los
// rankings SQL), así que nadie puede inflar sus puntos desde el navegador.
// De cada perfil solo salen nombre y foto (regla de 0076); nunca el
// user_id, el correo, la palabra ni las letras de los intentos.
//
// Las cuentas admin juegan pero no compiten: no salen en ninguna pestaña,
// no pueden ser ganador ni líder y no suman a su iglesia. Por eso Rachas e
// Iglesias se calculan aquí y no con las funciones SQL de 0054/0066.
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
  iglesia: string | null;
  admin: boolean;
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

/** Perfiles de los jugadores (solo en el servidor; al cliente salen nombre y foto). */
async function perfiles(service: ServiceClient, ids: string[]): Promise<Map<string, Perfil>> {
  const mapa = new Map<string, Perfil>();
  if (ids.length === 0) return mapa;
  const { data, error } = await service
    .from("profiles")
    .select("id, display_name, avatar_url, iglesia, role, tiktok_permiso")
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const p of (data ?? []) as Array<Record<string, unknown>>) {
    mapa.set(p.id as string, {
      nombre: ((p.display_name as string | null) ?? "").trim() || "Jugador",
      avatar: (p.avatar_url as string | null) ?? null,
      iglesia: ((p.iglesia as string | null) ?? "").trim() || null,
      admin: p.role === "admin",
      tiktok: p.tiktok_permiso === true,
    });
  }
  return mapa;
}

/** Quien resolvió la palabra del día, por puntos; en empate, quien terminó primero. */
function ordenarDia(partidas: Partida[], fecha: string) {
  return partidas
    .filter((p) => p.fecha === fecha && p.resuelta)
    .sort(
      (a, b) =>
        puntosDe(b.num_intentos, true) - puntosDe(a.num_intentos, true) || a.updated_at.localeCompare(b.updated_at)
    );
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

interface Racha {
  user_id: string;
  actual: number;
  maxima: number;
}

/**
 * Rachas vigentes hoy. Con 2 comodines como máximo, una racha sigue viva
 * hasta 3 días después de la última partida: lo de antes ni se lee.
 */
async function rachasVigentes(service: ServiceClient, hoy: string): Promise<Racha[]> {
  const { data, error } = await service
    .from("palabra_rachas")
    .select("user_id, actual, maxima, comodines, ultima_fecha")
    .gte("ultima_fecha", sumarDias(hoy, -3));
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => {
      const { racha } = rachaEfectiva(
        {
          actual: r.actual as number,
          maxima: r.maxima as number,
          comodines: r.comodines as number,
          ultimaFecha: (r.ultima_fecha as string | null) ?? null,
        },
        hoy
      );
      return { user_id: r.user_id as string, actual: racha.actual, maxima: racha.maxima };
    })
    .filter((r) => r.actual > 0);
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
  const [partidas, rachas] = await Promise.all([partidasEntre(service, desde, hoy), rachasVigentes(service, hoy)]);
  const mapa = await perfiles(service, [
    ...new Set([...partidas.map((p) => p.user_id), ...rachas.map((r) => r.user_id), ...(userId ? [userId] : [])]),
  ]);

  // Fuera los admin antes de ordenar: así nunca ocupan un lugar.
  const compite = (id: string) => mapa.has(id) && !mapa.get(id)!.admin;
  const enJuego = partidas.filter((p) => compite(p.user_id));
  const dia = ordenarDia(enJuego, hoy);
  const semana = sumarSemana(enJuego);
  const rachaDe = new Map(rachas.map((r) => [r.user_id, r.actual]));

  const persona = (id: string, posicion: number) => {
    const p = mapa.get(id);
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
    racha: rachaDe.get(s.user_id) ?? 0,
  }));
  const filasRachas: PalabraPuntosRachaFila[] = rachas
    .filter((r) => compite(r.user_id))
    .sort(
      (a, b) =>
        b.actual - a.actual ||
        b.maxima - a.maxima ||
        (mapa.get(a.user_id)?.nombre ?? "").localeCompare(mapa.get(b.user_id)?.nombre ?? "")
    )
    .slice(0, LIMITE)
    .map((r, i) => ({ ...persona(r.user_id, i + 1), actual: r.actual, maxima: r.maxima }));

  // Iglesias: mismos 7 días y mismas reglas, agrupadas sin importar mayúsculas.
  const iglesias = new Map<string, PalabraFilaRankingIglesia & { ids: Set<string> }>();
  for (const s of semana) {
    const nombre = mapa.get(s.user_id)?.iglesia;
    if (!nombre) continue;
    const clave = nombre.toLowerCase();
    const g = iglesias.get(clave) ?? { iglesia: nombre, puntos: 0, jugadores: 0, ids: new Set<string>() };
    g.puntos += s.puntos;
    g.ids.add(s.user_id);
    g.jugadores = g.ids.size;
    iglesias.set(clave, g);
  }

  return {
    hoy,
    desde,
    soyAdmin: userId ? mapa.get(userId)?.admin === true : false,
    dia: cortar(filasDia),
    semana: cortar(filasSemana),
    rachas: filasRachas,
    iglesias: [...iglesias.values()]
      .sort((a, b) => b.puntos - a.puntos || b.jugadores - a.jugadores || a.iglesia.localeCompare(b.iglesia))
      .slice(0, LIMITE)
      .map(({ iglesia, puntos, jugadores }) => ({ iglesia, puntos, jugadores })),
  };
}

/**
 * Tarjeta de TikTok de un día YA TERMINADO (fecha < hoy; quien llama lo
 * valida). Sin admins. Con nombre y foto solo quien dio permiso; los demás
 * se resumen en "y N hermanos más". El ganador siempre va arriba, como
 * "Hermano/a participante" si no dio permiso. Nunca iglesia.
 */
export async function getTarjetaTikTok(fecha: string): Promise<PalabraTarjetaTikTok> {
  const service = await createServiceClient();
  const desde = sumarDias(fecha, -6);
  const [partidas, palabra] = await Promise.all([
    partidasEntre(service, desde, fecha),
    getPalabraPorFecha(fecha, service),
  ]);
  const mapa = await perfiles(service, [...new Set(partidas.map((p) => p.user_id))]);
  const enJuego = partidas.filter((p) => mapa.has(p.user_id) && !mapa.get(p.user_id)!.admin);

  const dia = ordenarDia(enJuego, fecha);
  const semana = sumarSemana(enJuego);
  const conNombre = (id: string) => mapa.get(id)?.tiktok === true;
  const persona = (id: string, posicion: number) => {
    const p = mapa.get(id);
    return p?.tiktok
      ? { posicion, nombre: p.nombre, avatar: p.avatar, esYo: false }
      : { posicion, nombre: NOMBRE_SIN_PERMISO, avatar: null, esYo: false };
  };
  const filaDia = (p: Partida, i: number): PalabraPuntosHoyFila => ({
    ...persona(p.user_id, i + 1),
    intentos: p.num_intentos,
    pista: vioPista(p.fecha, p.num_intentos, p.resuelta, p.pista_usada),
    puntos: puntosDe(p.num_intentos, true),
  });

  // Top 3 y top 5: solo renglones con permiso (el ganador ya va arriba).
  const top3 = dia
    .slice(0, 3)
    .map(filaDia)
    .filter((f, i) => i > 0 && conNombre(dia[i].user_id));
  const top5 = semana
    .slice(0, 5)
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => conNombre(s.user_id))
    .map(({ s, i }) => ({ ...persona(s.user_id, i + 1), puntos: s.puntos, dias: s.dias, racha: 0 }));

  return {
    fecha,
    palabra: palabra ? revelar(palabra) : null,
    ganador: dia[0] ? filaDia(dia[0], 0) : null,
    top3,
    // Quienes la resolvieron y no salen con nombre (ni como ganador).
    otrosDia: Math.max(dia.length - 1 - top3.length, 0),
    top5Semana: top5,
    otrosSemana: semana.length - top5.length,
    jugadores: new Set(enJuego.filter((p) => p.fecha === fecha).map((p) => p.user_id)).size,
  };
}
