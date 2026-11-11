// src/lib/liga/consultas.server.ts
//
// Lecturas de la Liga con service role (liga_puntos no se lee desde el
// navegador). De los jugadores solo sale el nombre para mostrar y la foto
// de quien aceptó la regla general; los demás, "Hermano/a participante".
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { fechaDeHoy } from "@/lib/palabra/servidor";
import { inicioDeSemana, sumarDias } from "@/lib/palabra/logica";
import { NOMBRE_SIN_PERMISO } from "@/lib/palabra/puntos";
import { COLUMNAS_IGLESIA, nombreIglesia, type Comunidad, type IglesiaBase } from "./nombre";

type Servicio = Awaited<ReturnType<typeof createServiceClient>>;

export interface FilaLiga {
  id: string;
  lugar: number;
  nombre: string;
  comunidad: Comunidad;
  puntos: number;
  jugadores: number;
  campeona: boolean;
}

export interface JugadorLiga {
  lugar: number;
  nombre: string;
  avatar: string | null;
  puntos: number;
  esYo: boolean;
}

export interface MiIglesiaLiga {
  id: string;
  nombre: string;
  comunidad: Comunidad;
  aprobada: boolean;
  lugar: number | null;
  puntos: number;
  faltan: number | null;
  siguiente: { nombre: string; comunidad: Comunidad } | null;
  campeona: boolean;
}

export interface TablaLiga {
  semana: string;
  conSesion: boolean;
  aceptoReglas: boolean;
  top: FilaLiga[];
  mia: MiIglesiaLiga | null;
  jugadores: JugadorLiga[];
}

export interface CampeonaLiga {
  semana: string;
  nombre: string;
  puntos: number;
  jugadores: number;
}

export interface MiIglesia {
  id: string;
  nombre: string;
  comunidad: Comunidad;
  aprobada: boolean;
}

interface FilaSql {
  iglesia_id: string;
  puntos: number;
  jugadores: number;
}

export function semanaActual(): string {
  return inicioDeSemana(fechaDeHoy());
}

export async function aprobadas(service: Servicio): Promise<IglesiaBase[]> {
  const { data } = await service.from("iglesias").select(COLUMNAS_IGLESIA).eq("aprobada", true);
  return (data ?? []) as IglesiaBase[];
}

async function campeonaDe(service: Servicio, semana: string): Promise<string | null> {
  const { data } = await service.from("liga_campeonas").select("iglesia_id").eq("semana", semana).maybeSingle();
  return (data?.iglesia_id as string | null | undefined) ?? null;
}

async function tablaSql(service: Servicio, semana: string): Promise<FilaSql[]> {
  const { data, error } = await service.rpc("liga_tabla_semana", { p_semana: semana });
  if (error) {
    console.error("[liga] tabla:", error.message);
    return [];
  }
  return (data ?? []) as FilaSql[];
}

export async function getMiIglesia(
  userId: string,
  service?: Servicio
): Promise<{ iglesia: MiIglesia | null; preguntada: boolean; cambiadaEn: string | null }> {
  const s = service ?? (await createServiceClient());
  const { data: perfil } = await s
    .from("profiles")
    .select("iglesia_id, iglesia_preguntada, iglesia_cambiada_en")
    .eq("id", userId)
    .maybeSingle();
  const preguntada = perfil?.iglesia_preguntada === true;
  const cambiadaEn = (perfil?.iglesia_cambiada_en as string | null | undefined) ?? null;
  const id = (perfil?.iglesia_id as string | null | undefined) ?? null;
  if (!id) return { iglesia: null, preguntada, cambiadaEn };
  const [{ data: fila }, todas] = await Promise.all([
    s.from("iglesias").select(`${COLUMNAS_IGLESIA}, aprobada`).eq("id", id).maybeSingle(),
    aprobadas(s),
  ]);
  if (!fila) return { iglesia: null, preguntada, cambiadaEn };
  const ig = fila as IglesiaBase & { aprobada: boolean };
  return { iglesia: { id, nombre: nombreIglesia(ig, todas), comunidad: ig.comunidad, aprobada: ig.aprobada === true }, preguntada, cambiadaEn };
}

async function perfilesPublicos(
  service: Servicio,
  ids: string[]
): Promise<Map<string, { nombre: string; avatar: string | null; acepto: boolean }>> {
  const mapa = new Map<string, { nombre: string; avatar: string | null; acepto: boolean }>();
  if (ids.length === 0) return mapa;
  const { data } = await service.from("profiles").select("id, display_name, avatar_url, acepto_reglas_en").in("id", ids);
  for (const p of (data ?? []) as Array<Record<string, unknown>>) {
    mapa.set(p.id as string, {
      nombre: ((p.display_name as string | null) ?? "").trim() || "Jugador",
      avatar: (p.avatar_url as string | null) ?? null,
      acepto: Boolean(p.acepto_reglas_en),
    });
  }
  return mapa;
}

export async function getTablaLiga(userId: string | null, aceptoReglas = false): Promise<TablaLiga> {
  const service = await createServiceClient();
  const semana = semanaActual();
  const [todas, filas, campeonaId, mi] = await Promise.all([
    aprobadas(service),
    tablaSql(service, semana),
    campeonaDe(service, sumarDias(semana, -7)),
    userId ? getMiIglesia(userId, service) : Promise.resolve(null),
  ]);
  const porId = new Map(todas.map((i) => [i.id, i]));

  const conLugar: FilaLiga[] = filas.map((f, i) => {
    const ig = porId.get(f.iglesia_id);
    return {
      id: f.iglesia_id,
      lugar: i + 1,
      nombre: ig ? nombreIglesia(ig, todas) : "Equipo",
      comunidad: ig?.comunidad ?? "otra",
      puntos: f.puntos,
      jugadores: f.jugadores,
      campeona: f.iglesia_id === campeonaId,
    };
  });

  let mia: MiIglesiaLiga | null = null;
  const propia = mi?.iglesia ?? null;
  if (propia) {
    const idx = conLugar.findIndex((f) => f.id === propia.id);
    const fila = idx >= 0 ? conLugar[idx] : null;
    const arriba = idx > 0 ? conLugar[idx - 1] : idx < 0 && conLugar.length > 0 ? conLugar[conLugar.length - 1] : null;
    const puntos = fila?.puntos ?? 0;
    mia = {
      id: propia.id,
      nombre: propia.nombre,
      comunidad: propia.comunidad,
      aprobada: propia.aprobada,
      lugar: fila?.lugar ?? null,
      puntos,
      faltan: propia.aprobada && arriba ? arriba.puntos - puntos + 1 : null,
      siguiente: propia.aprobada && arriba ? { nombre: arriba.nombre, comunidad: arriba.comunidad } : null,
      campeona: propia.id === campeonaId,
    };
  }

  let jugadores: JugadorLiga[] = [];
  if (propia) {
    const { data } = await service.rpc("liga_jugadores_semana", { p_semana: semana, p_iglesia: propia.id, p_limite: 10 });
    const lista = (data ?? []) as Array<{ jugador: string; puntos: number }>;
    const perfiles = await perfilesPublicos(service, lista.map((j) => j.jugador));
    jugadores = lista.map((j, i) => {
      const p = perfiles.get(j.jugador);
      return {
        lugar: i + 1,
        nombre: p?.acepto ? p.nombre : NOMBRE_SIN_PERMISO,
        avatar: p?.acepto ? p.avatar : null,
        puntos: j.puntos,
        esYo: j.jugador === userId,
      };
    });
  }

  return { semana, conSesion: userId !== null, aceptoReglas, top: conLugar.slice(0, 10), mia, jugadores };
}

export async function getHistorialCampeonas(limite = 12): Promise<CampeonaLiga[]> {
  const service = await createServiceClient();
  const [{ data }, todas] = await Promise.all([
    service.from("liga_campeonas").select("semana, iglesia_id, puntos, jugadores").order("semana", { ascending: false }).limit(limite),
    aprobadas(service),
  ]);
  const porId = new Map(todas.map((i) => [i.id, i]));
  return ((data ?? []) as Array<{ semana: string; iglesia_id: string | null; puntos: number; jugadores: number }>).map((c) => {
    const ig = c.iglesia_id ? porId.get(c.iglesia_id) : undefined;
    return { semana: c.semana, nombre: ig ? nombreIglesia(ig, todas) : "Equipo que ya no existe", puntos: c.puntos, jugadores: c.jugadores };
  });
}

export interface DatosTarjetaLiga {
  semana: string;
  top3: Array<{ nombre: string; puntos: number }>;
  mejor: { nombre: string; avatar: string | null; puntos: number; equipo: string | null } | null;
}

/** Tarjeta de TikTok: top 3 y el mejor jugador SOLO si aceptó la regla. */
export async function getDatosTarjetaLiga(semana: string): Promise<DatosTarjetaLiga> {
  const service = await createServiceClient();
  const [todas, filas, { data: jug }] = await Promise.all([
    aprobadas(service),
    tablaSql(service, semana),
    service.rpc("liga_jugadores_semana", { p_semana: semana, p_iglesia: null, p_limite: 1 }),
  ]);
  const porId = new Map(todas.map((i) => [i.id, i]));
  const top3 = filas.slice(0, 3).map((f) => {
    const ig = porId.get(f.iglesia_id);
    return { nombre: ig ? nombreIglesia(ig, todas) : "Equipo", puntos: f.puntos };
  });
  let mejor: DatosTarjetaLiga["mejor"] = null;
  const primero = ((jug ?? []) as Array<{ jugador: string; puntos: number }>)[0];
  if (primero) {
    const p = (await perfilesPublicos(service, [primero.jugador])).get(primero.jugador);
    if (p?.acepto) {
      const { iglesia } = await getMiIglesia(primero.jugador, service);
      mejor = { nombre: p.nombre, avatar: p.avatar, puntos: primero.puntos, equipo: iglesia?.aprobada ? iglesia.nombre : null };
    }
  }
  return { semana, top3, mejor };
}

export async function getSemanasTarjeta(): Promise<string[]> {
  const service = await createServiceClient();
  const { data } = await service.from("liga_campeonas").select("semana").order("semana", { ascending: false }).limit(11);
  const actual = semanaActual();
  return [actual, ...((data ?? []) as Array<{ semana: string }>).map((c) => c.semana).filter((s) => s !== actual)];
}

export interface ResumenComunidades {
  lldm: number;
  otras: Array<{ denominacion: string; jugadores: number }>;
  amigos: number;
  sinElegir: number;
}

/** Para /admin/liga: jugadores (sin admins) por tipo de equipo, incluyendo equipos pendientes. */
export async function getResumenComunidades(): Promise<ResumenComunidades> {
  const service = await createServiceClient();
  const [{ data: igl }, { data: perf }] = await Promise.all([
    service.from("iglesias").select("id, comunidad, denominacion"),
    service.from("profiles").select("iglesia_id").neq("role", "admin"),
  ]);
  const tipo = new Map(((igl ?? []) as Array<{ id: string; comunidad: Comunidad; denominacion: string | null }>).map((i) => [i.id, i]));
  const r: ResumenComunidades = { lldm: 0, otras: [], amigos: 0, sinElegir: 0 };
  const otras = new Map<string, number>();
  for (const p of (perf ?? []) as Array<{ iglesia_id: string | null }>) {
    const ig = p.iglesia_id ? tipo.get(p.iglesia_id) : undefined;
    if (!ig) r.sinElegir += 1;
    else if (ig.comunidad === "lldm") r.lldm += 1;
    else if (ig.comunidad === "amigos") r.amigos += 1;
    else otras.set(ig.denominacion ?? "Otra", (otras.get(ig.denominacion ?? "Otra") ?? 0) + 1);
  }
  r.otras = [...otras.entries()].map(([denominacion, jugadores]) => ({ denominacion, jugadores })).sort((a, b) => b.jugadores - a.jugadores);
  return r;
}
