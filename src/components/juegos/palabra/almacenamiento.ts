// src/components/juegos/palabra/almacenamiento.ts
//
// Progreso de "Palabra del Día" para quien juega SIN sesión (localStorage).
// Con sesión todo vive en Supabase; aquí solo queda la marca de "ya vio la
// ayuda". Cada acceso va en try/catch: en modo privado o con el almacenamiento
// bloqueado, el juego sigue funcionando (solo no recuerda nada).
import { calcularEstadisticas, calcularRacha, diasEntre, rachaEfectiva } from "@/lib/palabra/logica";
import { PALABRA_DIAS_SINCRONIZABLES } from "@/lib/palabra/config";
import type { PalabraEstadoJugador, PalabraIntento, PalabraRevelada } from "@/types";

const CLAVE_PARTIDAS = "elim_palabra_v1";
const CLAVE_AYUDA = "elim_palabra_ayuda_v1";

export interface PartidaLocal {
  intentos: PalabraIntento[];
  terminada: boolean;
  resuelta: boolean;
  revelado: PalabraRevelada | null;
  /** Opcionales: las partidas guardadas antes de existir la pista no los traen. */
  pistaUsada?: boolean;
  pista?: string | null;
}

type Partidas = Record<string, PartidaLocal>;

export function leerPartidasLocales(): Partidas {
  try {
    const crudo = window.localStorage.getItem(CLAVE_PARTIDAS);
    if (!crudo) return {};
    const datos = JSON.parse(crudo) as { partidas?: Partidas };
    return datos.partidas && typeof datos.partidas === "object" ? datos.partidas : {};
  } catch {
    return {};
  }
}

export function guardarPartidaLocal(fecha: string, partida: PartidaLocal): void {
  try {
    const partidas = leerPartidasLocales();
    partidas[fecha] = partida;
    window.localStorage.setItem(CLAVE_PARTIDAS, JSON.stringify({ partidas }));
  } catch {
    // Sin almacenamiento disponible: la partida sigue en memoria.
  }
}

export function borrarPartidasLocales(): void {
  try {
    window.localStorage.removeItem(CLAVE_PARTIDAS);
  } catch {
    // nada que hacer
  }
}

export function ayudaYaVista(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_AYUDA) === "1";
  } catch {
    return true; // si no podemos recordar, no la mostramos en cada visita
  }
}

export function marcarAyudaVista(): void {
  try {
    window.localStorage.setItem(CLAVE_AYUDA, "1");
  } catch {
    // nada que hacer
  }
}

/** Estado del jugador sin sesión, calculado igual que en el servidor. */
export function estadoLocal(hoy: string): PalabraEstadoJugador {
  const partidas = leerPartidasLocales();
  const deHoy = partidas[hoy] ?? null;
  const entradas = Object.entries(partidas);
  const { racha, comodinesUsados } = rachaEfectiva(
    calcularRacha(entradas.filter(([, p]) => p.terminada).map(([fecha]) => fecha)),
    hoy
  );
  return {
    partida: deHoy
      ? {
          intentos: deHoy.intentos,
          terminada: deHoy.terminada,
          resuelta: deHoy.resuelta,
          pistaUsada: Boolean(deHoy.pistaUsada),
        }
      : null,
    revelado: deHoy?.terminada ? deHoy.revelado : null,
    pista: deHoy?.pista ?? null,
    racha,
    comodinesUsados,
    estadisticas: calcularEstadisticas(
      entradas.map(([, p]) => ({ terminada: p.terminada, resuelta: p.resuelta, numIntentos: p.intentos.length }))
    ),
  };
}

/** Lo que se manda a /api/juegos/palabra/sincronizar al iniciar sesión (solo palabras, nunca colores). */
export function partidasParaSincronizar(
  hoy: string
): Array<{ fecha: string; intentos: string[]; pistaUsada: boolean }> {
  return Object.entries(leerPartidasLocales())
    .filter(([fecha, p]) => {
      const antiguedad = diasEntre(fecha, hoy);
      return p.intentos.length > 0 && antiguedad >= 0 && antiguedad <= PALABRA_DIAS_SINCRONIZABLES;
    })
    .map(([fecha, p]) => ({ fecha, intentos: p.intentos.map((i) => i.palabra), pistaUsada: Boolean(p.pistaUsada) }));
}
