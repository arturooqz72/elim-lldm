// src/lib/palabra/servidor.ts
//
// Acceso a datos de "Palabra del Día". Todo lo que toca palabra_diaria usa
// el service role a propósito: la tabla no tiene ninguna policy de SELECT
// para anon/authenticated (ver 0054_palabra_del_dia.sql), así que la
// respuesta nunca sale de aquí salvo como colores o, al terminar, revelada.
import "server-only";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  calcularEstadisticas,
  calcularRacha,
  fechaEnZona,
  esCategoria,
  inicioDeSemana,
  pistaCapitulo,
  rachaEfectiva,
  tieneSegundaPista,
} from "./logica";
import type {
  PalabraCategoria,
  PalabraEstadoJugador,
  PalabraFilaRankingIglesia,
  PalabraFilaRankingRacha,
  PalabraFilaRankingSemanal,
  PalabraIntento,
  PalabraRevelada,
} from "@/types";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export interface FilaPartida {
  id: string;
  fecha: string;
  intentos: PalabraIntento[];
  num_intentos: number;
  resuelta: boolean;
  terminada: boolean;
  pista_usada: boolean;
  origen: "servidor" | "local";
}

export const COLUMNAS_PARTIDA = "id, fecha, intentos, num_intentos, resuelta, terminada, pista_usada, origen";

/** Palabra del día con sus pistas. Solo servidor: nunca se manda entera antes de terminar. */
export interface PalabraDelDia extends PalabraRevelada {
  categoria: PalabraCategoria | null;
}

const COLUMNAS_PALABRA = "palabra, explicacion, referencia, categoria, libro, capitulo";

function aPalabraDelDia(fila: Record<string, unknown>): PalabraDelDia {
  return {
    palabra: fila.palabra as string,
    explicacion: fila.explicacion as string,
    referencia: fila.referencia as string,
    libro: fila.libro as string,
    capitulo: fila.capitulo as number,
    categoria: esCategoria(fila.categoria) ? fila.categoria : null,
  };
}

/** Lo que se revela al terminar (sin la categoría, que ya se veía). */
export function revelar(p: PalabraDelDia): PalabraRevelada {
  return { palabra: p.palabra, explicacion: p.explicacion, referencia: p.referencia, libro: p.libro, capitulo: p.capitulo };
}

/** Segunda pista si ya le toca (2 intentos fallidos); null si todavía no. */
export function segundaPista(p: PalabraDelDia, numIntentos: number, resuelta: boolean): string | null {
  return tieneSegundaPista(numIntentos, resuelta) ? pistaCapitulo(p.libro, p.capitulo, p.palabra) : null;
}

export function fechaDeHoy(): string {
  return fechaEnZona();
}

export async function getPalabraPorFecha(
  fecha: string,
  service?: ServiceClient
): Promise<PalabraDelDia | null> {
  const client = service ?? (await createServiceClient());
  const { data, error } = await client
    .from("palabra_diaria")
    .select(COLUMNAS_PALABRA)
    .eq("fecha", fecha)
    .maybeSingle();
  if (error) {
    console.error("[palabra] no se pudo leer la palabra del día:", error.message);
    return null;
  }
  return data ? aPalabraDelDia(data as Record<string, unknown>) : null;
}

export async function getPalabrasPorFechas(
  fechas: string[],
  service: ServiceClient
): Promise<Map<string, PalabraRevelada>> {
  const mapa = new Map<string, PalabraRevelada>();
  if (fechas.length === 0) return mapa;
  const { data } = await service
    .from("palabra_diaria")
    .select(`fecha, ${COLUMNAS_PALABRA}`)
    .in("fecha", fechas);
  for (const fila of (data ?? []) as Array<Record<string, unknown>>) {
    mapa.set(fila.fecha as string, revelar(aPalabraDelDia(fila)));
  }
  return mapa;
}

/**
 * Recalcula la racha desde el historial completo (todas las partidas
 * terminadas) y la guarda. Recalcular en vez de incrementar evita que un
 * doble envío o una sincronización desordenada dejen la racha inconsistente.
 */
export async function recalcularRacha(userId: string, service: ServiceClient): Promise<void> {
  const { data } = await service
    .from("palabra_partidas")
    .select("fecha")
    .eq("user_id", userId)
    .eq("terminada", true);
  const racha = calcularRacha(((data ?? []) as Array<{ fecha: string }>).map((f) => f.fecha));
  const { error } = await service.from("palabra_rachas").upsert({
    user_id: userId,
    actual: racha.actual,
    maxima: racha.maxima,
    comodines: racha.comodines,
    ultima_fecha: racha.ultimaFecha,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("[palabra] no se pudo guardar la racha:", error.message);
}

/** Estado completo del jugador con sesión: partida de hoy, racha efectiva y estadísticas. */
export async function getEstadoJugador(
  userId: string,
  hoy: string,
  service?: ServiceClient
): Promise<PalabraEstadoJugador> {
  const client = service ?? (await createServiceClient());

  const [{ data: partidas }, { data: rachaFila }] = await Promise.all([
    client.from("palabra_partidas").select(COLUMNAS_PARTIDA).eq("user_id", userId),
    client
      .from("palabra_rachas")
      .select("actual, maxima, comodines, ultima_fecha")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const filas = (partidas ?? []) as FilaPartida[];
  const deHoy = filas.find((p) => p.fecha === hoy) ?? null;

  const rachaGuardada = rachaFila
    ? {
        actual: rachaFila.actual as number,
        maxima: rachaFila.maxima as number,
        comodines: rachaFila.comodines as number,
        ultimaFecha: (rachaFila.ultima_fecha as string | null) ?? null,
      }
    : calcularRacha([]);
  const { racha, comodinesUsados } = rachaEfectiva(rachaGuardada, hoy);

  // La palabra de hoy se lee en el servidor para sus pistas; al navegador
  // solo llegan la categoría, la segunda pista cuando ya le toca y, al
  // terminar, la palabra revelada.
  const palabraHoy = await getPalabraPorFecha(hoy, client);

  return {
    partida: deHoy
      ? {
          intentos: deHoy.intentos ?? [],
          terminada: deHoy.terminada,
          resuelta: deHoy.resuelta,
          pistaUsada: deHoy.pista_usada,
        }
      : null,
    revelado: deHoy?.terminada && palabraHoy ? revelar(palabraHoy) : null,
    categoria: palabraHoy?.categoria ?? null,
    pista: deHoy && palabraHoy ? segundaPista(palabraHoy, deHoy.num_intentos, deHoy.resuelta) : null,
    racha,
    comodinesUsados,
    estadisticas: calcularEstadisticas(
      filas.map((p) => ({ terminada: p.terminada, resuelta: p.resuelta, numIntentos: p.num_intentos }))
    ),
  };
}

/** Solo para la tarjeta del hub: si ya jugó hoy y su racha visible. */
export async function getResumenHub(
  userId: string | null
): Promise<{ jugoHoy: boolean; resuelta: boolean; racha: number } | null> {
  if (!userId) return null;
  const hoy = fechaDeHoy();
  const supabase = await createClient();
  const [{ data: partida }, { data: rachaFila }] = await Promise.all([
    supabase
      .from("palabra_partidas")
      .select("terminada, resuelta")
      .eq("user_id", userId)
      .eq("fecha", hoy)
      .maybeSingle(),
    supabase
      .from("palabra_rachas")
      .select("actual, maxima, comodines, ultima_fecha")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const { racha } = rachaEfectiva(
    rachaFila
      ? {
          actual: rachaFila.actual as number,
          maxima: rachaFila.maxima as number,
          comodines: rachaFila.comodines as number,
          ultimaFecha: (rachaFila.ultima_fecha as string | null) ?? null,
        }
      : calcularRacha([]),
    hoy
  );
  return {
    jugoHoy: Boolean(partida?.terminada),
    resuelta: Boolean(partida?.resuelta),
    racha: racha.actual,
  };
}

export async function hayPalabraHoy(hoy: string): Promise<boolean> {
  const service = await createServiceClient();
  const { count } = await service
    .from("palabra_diaria")
    .select("id", { count: "exact", head: true })
    .eq("fecha", hoy);
  return (count ?? 0) > 0;
}

export interface RankingsPalabra {
  inicioSemana: string;
  semanal: PalabraFilaRankingSemanal[];
  rachas: PalabraFilaRankingRacha[];
  iglesias: PalabraFilaRankingIglesia[];
}

/**
 * Rankings vía funciones SECURITY DEFINER (solo datos públicos). Fallan en
 * silencio a listas vacías para no tirar la página si la migración aún no
 * se aplicó en ese entorno (mismo criterio que getTablaPosiciones).
 */
export async function getRankings(hoy: string, limite = 10): Promise<RankingsPalabra> {
  const supabase = await createClient();
  const inicioSemana = inicioDeSemana(hoy);
  const [semanal, rachas, iglesias] = await Promise.all([
    supabase.rpc("palabra_ranking_semanal", { p_inicio: inicioSemana, p_limite: limite }),
    supabase.rpc("palabra_ranking_rachas", { p_hoy: hoy, p_limite: limite }),
    supabase.rpc("palabra_ranking_iglesias", { p_inicio: inicioSemana, p_limite: limite }),
  ]);
  for (const r of [semanal, rachas, iglesias]) {
    if (r.error) console.error("[palabra] ranking:", r.error.message);
  }
  return {
    inicioSemana,
    semanal: (semanal.data ?? []) as PalabraFilaRankingSemanal[],
    rachas: (rachas.data ?? []) as PalabraFilaRankingRacha[],
    iglesias: (iglesias.data ?? []) as PalabraFilaRankingIglesia[],
  };
}
