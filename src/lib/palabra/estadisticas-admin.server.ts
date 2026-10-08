// src/lib/palabra/estadisticas-admin.server.ts
//
// Estadísticas de la Palabra del Día para /admin/palabra (service role).
// Por día: partidas empezadas, ganadas, perdidas y abandonadas, porcentaje
// de victorias y cuántos ganaron antes y después de ver la segunda pista
// ("Búscala en Mateo 6", que aparece tras 2 intentos fallidos), más los
// intentos rechazados por "palabra no válida" (palabra_rechazos, desde
// 0067). No cuenta cuentas admin.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { PALABRA_FALLOS_SEGUNDA_PISTA, PALABRA_INICIO_PISTAS, PALABRA_INICIO_RECHAZOS } from "./config";
import { sumarDias } from "./logica";

export interface DiaPalabraAdmin {
  fecha: string;
  palabra: string | null;
  empezadas: number;
  ganadas: number;
  perdidas: number;
  /** Con intentos pero sin terminar, de días que ya pasaron. */
  abandonadas: number;
  /** Hoy: con intentos y todavía sin terminar. */
  enCurso: number;
  /** Ganadas ÷ terminadas, 0-100; null si nadie terminó. */
  porcentaje: number | null;
  /** Ganaron sin llegar a la segunda pista (en 1 o 2 intentos). */
  antesSegundaPista: number;
  /** Ganaron después de ver la segunda pista. */
  despuesSegundaPista: number;
  /** El día ya tenía las pistas nuevas (antes de eso las dos columnas de pista no aplican). */
  conPistasNuevas: boolean;
  /** Intentos rechazados por "palabra no válida". */
  rechazadas: number;
  /** Ya se registraban los rechazos ese día (antes de eso la columna no aplica). */
  conRechazos: boolean;
}

export interface RechazoFrecuente {
  intento: string;
  veces: number;
  /** Personas distintas que la intentaron. */
  personas: number;
}

export interface EstadisticasPalabraAdmin {
  dias: DiaPalabraAdmin[];
  /** Palabras rechazadas más veces en el rango (candidatas a agregar a la lista). */
  masRechazadas: RechazoFrecuente[];
}

export async function leerEstadisticasPalabra(hoy: string, dias = 14): Promise<EstadisticasPalabraAdmin> {
  const supabase = await createServiceClient();
  const desde = sumarDias(hoy, -(dias - 1));

  const [{ data: admins }, { data: partidas }, { data: palabras }, { data: rechazos }] = await Promise.all([
    supabase.from("profiles").select("id").eq("role", "admin"),
    supabase
      .from("palabra_partidas")
      .select("user_id, fecha, num_intentos, resuelta, terminada")
      .gte("fecha", desde)
      .lte("fecha", hoy),
    supabase.from("palabra_diaria").select("fecha, palabra").gte("fecha", desde).lte("fecha", hoy),
    supabase
      .from("palabra_rechazos")
      .select("user_id, fecha, intento")
      .gte("fecha", desde)
      .lte("fecha", hoy)
      .limit(10000),
  ]);
  const esAdmin = new Set(((admins ?? []) as { id: string }[]).map((a) => a.id));
  const palabraDe = new Map(((palabras ?? []) as { fecha: string; palabra: string }[]).map((p) => [p.fecha, p.palabra]));

  const porDia = new Map<string, DiaPalabraAdmin>();
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(desde, i);
    porDia.set(fecha, {
      fecha,
      palabra: palabraDe.get(fecha) ?? null,
      empezadas: 0,
      ganadas: 0,
      perdidas: 0,
      abandonadas: 0,
      enCurso: 0,
      porcentaje: null,
      antesSegundaPista: 0,
      despuesSegundaPista: 0,
      conPistasNuevas: fecha >= PALABRA_INICIO_PISTAS,
      rechazadas: 0,
      conRechazos: fecha >= PALABRA_INICIO_RECHAZOS,
    });
  }

  type Fila = { user_id: string; fecha: string; num_intentos: number; resuelta: boolean; terminada: boolean };
  for (const p of (partidas ?? []) as Fila[]) {
    const d = porDia.get(p.fecha);
    // Sin intentos = solo abrió la pista del sistema anterior: no empezó a jugar.
    if (!d || esAdmin.has(p.user_id) || p.num_intentos === 0) continue;
    d.empezadas++;
    if (p.terminada && p.resuelta) {
      d.ganadas++;
      // Ganó en el intento N: vio la segunda pista si antes falló al menos 2 veces.
      if (p.num_intentos - 1 >= PALABRA_FALLOS_SEGUNDA_PISTA) d.despuesSegundaPista++;
      else d.antesSegundaPista++;
    } else if (p.terminada) d.perdidas++;
    else if (p.fecha === hoy) d.enCurso++;
    else d.abandonadas++;
  }

  const frecuentes = new Map<string, { veces: number; quienes: Set<string> }>();
  type Rechazo = { user_id: string | null; fecha: string; intento: string };
  for (const r of (rechazos ?? []) as Rechazo[]) {
    const d = porDia.get(r.fecha);
    if (!d || (r.user_id && esAdmin.has(r.user_id))) continue;
    d.rechazadas++;
    const f = frecuentes.get(r.intento) ?? { veces: 0, quienes: new Set<string>() };
    f.veces++;
    if (r.user_id) f.quienes.add(r.user_id);
    frecuentes.set(r.intento, f);
  }

  for (const d of porDia.values()) {
    const terminadas = d.ganadas + d.perdidas;
    d.porcentaje = terminadas ? Math.round((d.ganadas / terminadas) * 100) : null;
  }
  const masRechazadas = [...frecuentes.entries()]
    .map(([intento, f]) => ({ intento, veces: f.veces, personas: f.quienes.size }))
    .sort((a, b) => b.personas - a.personas || b.veces - a.veces || a.intento.localeCompare(b.intento))
    .slice(0, 15);
  return { dias: [...porDia.values()].reverse(), masRechazadas };
}
