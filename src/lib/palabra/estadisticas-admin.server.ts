// src/lib/palabra/estadisticas-admin.server.ts
//
// Estadísticas de la Palabra del Día para /admin/palabra (service role).
// Por día: partidas empezadas, ganadas, perdidas y abandonadas, porcentaje
// de victorias y cuántos ganaron antes y después de ver la segunda pista
// ("Búscala en Mateo 6", que aparece tras 2 intentos fallidos). No cuenta
// cuentas admin.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { PALABRA_FALLOS_SEGUNDA_PISTA, PALABRA_INICIO_PISTAS } from "./config";
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
}

export async function leerEstadisticasPalabra(hoy: string, dias = 14): Promise<DiaPalabraAdmin[]> {
  const supabase = await createServiceClient();
  const desde = sumarDias(hoy, -(dias - 1));

  const [{ data: admins }, { data: partidas }, { data: palabras }] = await Promise.all([
    supabase.from("profiles").select("id").eq("role", "admin"),
    supabase
      .from("palabra_partidas")
      .select("user_id, fecha, num_intentos, resuelta, terminada")
      .gte("fecha", desde)
      .lte("fecha", hoy),
    supabase.from("palabra_diaria").select("fecha, palabra").gte("fecha", desde).lte("fecha", hoy),
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

  for (const d of porDia.values()) {
    const terminadas = d.ganadas + d.perdidas;
    d.porcentaje = terminadas ? Math.round((d.ganadas / terminadas) * 100) : null;
  }
  return [...porDia.values()].reverse();
}
