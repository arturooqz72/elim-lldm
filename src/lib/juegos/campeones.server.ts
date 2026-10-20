// src/lib/juegos/campeones.server.ts
//
// Datos del video "Campeones de la semana" (/admin/juegos/tiktok): de lunes
// a domingo en hora del Pacífico, el podio de la Trivia en línea, el
// Ahorcado y la Ruleta, y en la Palabra del Día la mejor racha y quién la
// resolvió más días. Los admins no cuentan. Quien no dio permiso de TikTok
// sale como "Hermano/a participante", sin foto; los demás con su nombre
// corto ("Arturo O."). Nada de ids, correos ni nombres completos sale de
// aquí.
//
// Un juego se salta si en la semana jugaron menos de 2 personas; la
// Ruleta, además, si hubo menos de 3 partidas.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { calcularRacha, rachaEfectiva, sumarDias } from "@/lib/palabra/logica";
import { PALABRA_TZ } from "@/lib/palabra/config";
import { NOMBRE_SIN_PERMISO, nombreCorto } from "@/lib/palabra/puntos";
import type {
  CampeonesFila,
  CampeonesJuego,
  CampeonesJuegoId,
  CampeonesPalabra,
  CampeonesPersonaPalabra,
  CampeonesSemana,
} from "@/types";

const MIN_JUGADORES = 2;
const MIN_PARTIDAS_RULETA = 3;
/** El Ahorcado guarda cada palabra desde 0080; su primera semana completa empieza este lunes. */
export const AHORCADO_DESDE = "2026-10-26";

type Service = Awaited<ReturnType<typeof createServiceClient>>;

interface Perfil {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  tiktok_permiso: boolean | null;
}

/** Instante (ISO) en que empieza `fecha` en hora del Pacífico (cuida el cambio de horario). */
export function inicioDelDia(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const aprox = new Date(Date.UTC(y, m - 1, d, 8));
  const desfase = new Intl.DateTimeFormat("en-US", { timeZone: PALABRA_TZ, timeZoneName: "shortOffset" })
    .formatToParts(aprox)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT-7"
  const horas = Number(desfase?.replace("GMT", "") || -8);
  return new Date(Date.UTC(y, m - 1, d) - horas * 3_600_000).toISOString();
}

/** Sumas por persona: puntos y partidas. */
type Totales = Map<string, { puntos: number; partidas: number }>;

function sumar(totales: Totales, userId: string, puntos: number): void {
  const t = totales.get(userId) ?? { puntos: 0, partidas: 0 };
  t.puntos += puntos;
  t.partidas += 1;
  totales.set(userId, t);
}

async function totalesDeSalas(
  service: Service,
  jugadores: "arena_publica_jugadores" | "ruleta_jugadores",
  salas: "arena_publica_salas" | "ruleta_salas",
  desde: string,
  hasta: string
): Promise<{ totales: Totales; salas: Set<string> }> {
  // ruleta_jugadores tiene dos relaciones con ruleta_salas (la sala y el
  // turno): se nombra la de la sala.
  const relacion = `${salas}!${jugadores}_sala_id_fkey!inner(status, created_at)`;
  const { data, error } = await service
    .from(jugadores)
    .select(`user_id, puntos, sala_id, ${relacion}`)
    .eq(`${salas}.status`, "finished")
    .gte(`${salas}.created_at`, desde)
    .lt(`${salas}.created_at`, hasta)
    .not("user_id", "is", null)
    .limit(10000);
  if (error) throw new Error(`${jugadores}: ${error.message}`);
  const totales: Totales = new Map();
  const vistas = new Set<string>();
  for (const fila of (data ?? []) as unknown as Array<{ user_id: string; puntos: number; sala_id: string }>) {
    sumar(totales, fila.user_id, fila.puntos);
    vistas.add(fila.sala_id);
  }
  return { totales, salas: vistas };
}

async function totalesAhorcado(service: Service, desde: string, hasta: string): Promise<Totales> {
  const { data, error } = await service
    .from("ahorcado_resultados")
    .select("user_id, puntos")
    .gte("created_at", desde)
    .lt("created_at", hasta)
    .limit(20000);
  if (error) throw new Error(`ahorcado_resultados: ${error.message}`);
  const totales: Totales = new Map();
  for (const fila of (data ?? []) as Array<{ user_id: string; puntos: number }>) sumar(totales, fila.user_id, fila.puntos);
  return totales;
}

interface PartidaPalabra {
  user_id: string;
  fecha: string;
  resuelta: boolean;
  num_intentos: number;
  origen: string;
}

async function partidasPalabra(service: Service, lunes: string, domingo: string): Promise<PartidaPalabra[]> {
  const columnas = "user_id, fecha, resuelta, num_intentos, origen";
  const { data: semana, error } = await service
    .from("palabra_partidas")
    .select("user_id")
    .eq("terminada", true)
    .gte("fecha", lunes)
    .lte("fecha", domingo)
    .limit(10000);
  if (error) throw new Error(`palabra_partidas: ${error.message}`);
  const ids = [...new Set(((semana ?? []) as Array<{ user_id: string }>).map((p) => p.user_id))];
  if (ids.length === 0) return [];
  // Toda su historia hasta el domingo: la racha viene de semanas anteriores.
  const { data, error: e2 } = await service
    .from("palabra_partidas")
    .select(columnas)
    .eq("terminada", true)
    .lte("fecha", domingo)
    .in("user_id", ids)
    .limit(50000);
  if (e2) throw new Error(`palabra_partidas: ${e2.message}`);
  return (data ?? []) as PartidaPalabra[];
}

async function perfiles(service: Service, ids: string[]): Promise<Map<string, Perfil>> {
  const mapa = new Map<string, Perfil>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await service
      .from("profiles")
      .select("id, display_name, avatar_url, role, tiktok_permiso")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`profiles: ${error.message}`);
    for (const p of (data ?? []) as Perfil[]) mapa.set(p.id, p);
  }
  return mapa;
}

function persona(p: Perfil | undefined): { nombre: string; avatar: string | null; conPermiso: boolean } {
  if (p?.tiktok_permiso !== true) return { nombre: NOMBRE_SIN_PERMISO, avatar: null, conPermiso: false };
  return { nombre: nombreCorto(p.display_name ?? ""), avatar: p.avatar_url, conPermiso: true };
}

const esAdmin = (p: Perfil | undefined) => p?.role === "admin";

function podio(totales: Totales, gente: Map<string, Perfil>): { podio: CampeonesFila[]; jugadores: number } {
  const filas = [...totales.entries()]
    .filter(([id]) => gente.has(id) && !esAdmin(gente.get(id)))
    .sort(([, a], [, b]) => b.puntos - a.puntos || a.partidas - b.partidas);
  return {
    jugadores: filas.length,
    podio: filas.slice(0, 3).map(([id, t], i) => ({ posicion: i + 1, ...persona(gente.get(id)), ...t })),
  };
}

function campeonesPalabra(partidas: PartidaPalabra[], gente: Map<string, Perfil>, lunes: string, domingo: string): CampeonesPalabra | null {
  const porPersona = new Map<string, PartidaPalabra[]>();
  for (const p of partidas) {
    if (esAdmin(gente.get(p.user_id)) || !gente.has(p.user_id)) continue;
    porPersona.set(p.user_id, [...(porPersona.get(p.user_id) ?? []), p]);
  }
  const filas = [...porPersona.entries()].map(([id, ps]) => {
    const enSemana = ps.filter((p) => p.fecha >= lunes);
    // Igual que en el juego: la racha cuenta los días jugados, al terminar el domingo.
    const racha = rachaEfectiva(calcularRacha(ps.map((p) => p.fecha)), sumarDias(domingo, 1)).racha.actual;
    // Solo partidas jugadas en el servidor (las del navegador se pudieron jugar sabiendo la respuesta).
    const resueltas = enSemana.filter((p) => p.resuelta && p.origen === "servidor");
    const intentos = resueltas.reduce((s, p) => s + p.num_intentos, 0);
    return { id, jugoSemana: enSemana.length > 0, racha, dias: resueltas.length, intentos };
  });
  const jugaron = filas.filter((f) => f.jugoSemana);
  if (jugaron.length < MIN_JUGADORES) return null;
  const [mejorRacha] = [...jugaron].sort((a, b) => b.racha - a.racha || b.dias - a.dias);
  const [masDias] = [...jugaron].sort((a, b) => b.dias - a.dias || a.intentos - b.intentos);
  if (!masDias || masDias.dias === 0 || !mejorRacha) return null;
  const de = (id: string, valor: number): CampeonesPersonaPalabra => ({ ...persona(gente.get(id)), valor });
  return { racha: de(mejorRacha.id, mejorRacha.racha), masDias: de(masDias.id, masDias.dias), jugadores: jugaron.length };
}

const NOMBRES: Record<CampeonesJuegoId, string> = {
  trivia: "Trivia en línea",
  ahorcado: "Ahorcado del Nuevo Testamento",
  ruleta: "La Ruleta en línea",
};

/** Campeones de la semana que empieza el lunes `lunes`. */
export async function getCampeonesSemana(lunes: string): Promise<CampeonesSemana> {
  const domingo = sumarDias(lunes, 6);
  const desde = inicioDelDia(lunes);
  const hasta = inicioDelDia(sumarDias(lunes, 7));
  const service = await createServiceClient();

  const [trivia, ruleta, ahorcado, palabra] = await Promise.all([
    totalesDeSalas(service, "arena_publica_jugadores", "arena_publica_salas", desde, hasta),
    totalesDeSalas(service, "ruleta_jugadores", "ruleta_salas", desde, hasta),
    lunes >= AHORCADO_DESDE ? totalesAhorcado(service, desde, hasta) : Promise.resolve<Totales>(new Map()),
    partidasPalabra(service, lunes, domingo),
  ]);
  const ids = [
    ...new Set([...trivia.totales.keys(), ...ruleta.totales.keys(), ...ahorcado.keys(), ...palabra.map((p) => p.user_id)]),
  ];
  const gente = await perfiles(service, ids);

  const juegos: CampeonesJuego[] = [];
  const saltados: CampeonesSemana["saltados"] = [];
  const revisar = (id: CampeonesJuegoId, totales: Totales, partidas: number, motivoExtra: string | null) => {
    const p = podio(totales, gente);
    const nombre = NOMBRES[id];
    if (motivoExtra) saltados.push({ nombre, motivo: motivoExtra });
    else if (p.jugadores < MIN_JUGADORES)
      saltados.push({ nombre, motivo: p.jugadores === 0 ? "nadie jugó" : "solo jugó 1 persona (mínimo 2)" });
    else juegos.push({ id, nombre, ...p, partidas });
  };

  revisar("trivia", trivia.totales, trivia.salas.size, null);
  const partidasAhorcado = [...ahorcado.values()].reduce((s, t) => s + t.partidas, 0);
  revisar(
    "ahorcado",
    ahorcado,
    partidasAhorcado,
    lunes < AHORCADO_DESDE ? "su historial empezó el 19 de octubre; entra desde la semana del 26" : null
  );
  revisar(
    "ruleta",
    ruleta.totales,
    ruleta.salas.size,
    ruleta.salas.size < MIN_PARTIDAS_RULETA
      ? `solo ${ruleta.salas.size} ${ruleta.salas.size === 1 ? "partida" : "partidas"} (mínimo ${MIN_PARTIDAS_RULETA})`
      : null
  );

  const campeonesDeLaPalabra = campeonesPalabra(palabra, gente, lunes, domingo);
  if (!campeonesDeLaPalabra) saltados.push({ nombre: "Palabra del Día", motivo: "menos de 2 personas o nadie la resolvió" });

  return { lunes, domingo, juegos, palabra: campeonesDeLaPalabra, saltados };
}
