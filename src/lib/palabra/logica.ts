// src/lib/palabra/logica.ts
//
// Lógica pura de "Palabra del Día", compartida entre servidor y cliente:
// normalización, evaluación de colores, fechas en la zona fija, racha con
// comodines, estadísticas, pistas y texto para compartir. Sin "server-only" y sin
// acceso a la palabra del día — esa solo vive en el servidor.
import {
  PALABRA_DIAS_POR_COMODIN,
  PALABRA_EPOCH,
  PALABRA_FALLOS_SEGUNDA_PISTA,
  PALABRA_LONGITUD,
  PALABRA_MAX_COMODINES,
  PALABRA_MAX_INTENTOS,
  PALABRA_TZ,
  PALABRA_URL_COMPARTIR,
} from "./config";
import { buscarLibro } from "./libros";
import type {
  PalabraCategoria,
  PalabraColor,
  PalabraEstadisticas,
  PalabraIntento,
  PalabraRacha,
} from "@/types";

// ---------- Texto ----------

/** Mayúsculas, sin acentos (á = a, ü = u), conservando la Ñ. */
export function normalizarPalabra(texto: string): string {
  return texto
    .trim()
    .toUpperCase()
    .replace(/Ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "Ñ");
}

export function tieneFormatoValido(normalizada: string): boolean {
  return new RegExp(`^[A-ZÑ]{${PALABRA_LONGITUD}}$`).test(normalizada);
}

/**
 * Colores de un intento contra la respuesta (ambos ya normalizados).
 * Maneja letras repetidas como Wordle: primero se marcan las verdes, y solo
 * las letras de la respuesta que sobran pueden volverse amarillas — así
 * "LLAVE" contra "PALMA" da una sola L amarilla, no dos.
 */
export function evaluarIntento(intento: string, respuesta: string): PalabraColor[] {
  const g = [...intento];
  const r = [...respuesta];
  const colores: PalabraColor[] = g.map(() => "absent");
  const sobrantes = new Map<string, number>();

  g.forEach((letra, i) => {
    if (letra === r[i]) colores[i] = "correct";
    else sobrantes.set(r[i], (sobrantes.get(r[i]) ?? 0) + 1);
  });

  g.forEach((letra, i) => {
    if (colores[i] === "correct") return;
    const quedan = sobrantes.get(letra) ?? 0;
    if (quedan > 0) {
      colores[i] = "present";
      sobrantes.set(letra, quedan - 1);
    }
  });

  return colores;
}

// ---------- Fechas (siempre "YYYY-MM-DD" en PALABRA_TZ) ----------

export function fechaEnZona(instante: Date = new Date(), tz: string = PALABRA_TZ): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

function aUtcMs(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(aUtcMs(fecha) + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Días de `desde` a `hasta` (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtcMs(hasta) - aUtcMs(desde)) / 86_400_000);
}

export function esFechaIso(texto: unknown): texto is string {
  return typeof texto === "string" && /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(aUtcMs(texto));
}

/** Lunes de la semana (lunes a domingo) que contiene `fecha`. */
export function inicioDeSemana(fecha: string): string {
  const diaSemana = new Date(aUtcMs(fecha)).getUTCDay(); // 0 = domingo
  return sumarDias(fecha, -((diaSemana + 6) % 7));
}

/** Número del reto para compartir (#1 = PALABRA_EPOCH). */
export function numeroDelDia(fecha: string): number {
  return diasEntre(PALABRA_EPOCH, fecha) + 1;
}

/** Diferencia entre la hora local de `tz` y UTC en ese instante, en ms. */
function desfaseMs(instante: Date, tz: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);
  const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const comoUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/** Milisegundos hasta la próxima medianoche en `tz` (correcto también en días de cambio de horario). */
export function msHastaSiguienteDia(ahora: Date = new Date(), tz: string = PALABRA_TZ): number {
  const medianocheComoUtc = aUtcMs(sumarDias(fechaEnZona(ahora, tz), 1));
  let objetivo = medianocheComoUtc - desfaseMs(new Date(medianocheComoUtc), tz);
  // Segunda pasada por si el desfase cambia justo entre ambos instantes (DST).
  objetivo = medianocheComoUtc - desfaseMs(new Date(objetivo), tz);
  return Math.max(0, objetivo - ahora.getTime());
}

// ---------- Racha ----------

const RACHA_VACIA: PalabraRacha = { actual: 0, maxima: 0, comodines: 0, ultimaFecha: null };

/**
 * Racha a partir de las fechas jugadas (partidas terminadas, ganadas o no).
 *
 * - Día siguiente al anterior: la racha sube.
 * - Faltó N días y tiene ≥ N comodines: se gastan N y la racha sigue (los
 *   días cubiertos no suman, solo protegen).
 * - Faltó más días de los que cubren sus comodines: la racha vuelve a 1 y
 *   los comodines se pierden (se usaron intentando cubrir el hueco).
 * - Cada vez que la racha llega a un múltiplo de 7 gana un comodín (máx. 2).
 */
export function calcularRacha(fechasJugadas: string[]): PalabraRacha {
  const fechas = [...new Set(fechasJugadas)].sort();
  if (fechas.length === 0) return { ...RACHA_VACIA };

  let actual = 0;
  let maxima = 0;
  let comodines = 0;
  let anterior: string | null = null;

  for (const fecha of fechas) {
    if (anterior === null) {
      actual = 1;
    } else {
      const faltados = diasEntre(anterior, fecha) - 1;
      if (faltados === 0) {
        actual += 1;
      } else if (faltados <= comodines) {
        comodines -= faltados;
        actual += 1;
      } else {
        actual = 1;
        comodines = 0;
      }
    }
    if (actual % PALABRA_DIAS_POR_COMODIN === 0) {
      comodines = Math.min(PALABRA_MAX_COMODINES, comodines + 1);
    }
    maxima = Math.max(maxima, actual);
    anterior = fecha;
  }

  return { actual, maxima, comodines, ultimaFecha: anterior };
}

/**
 * La racha tal como se ve HOY: si desde la última partida faltó días (sin
 * contar hoy, que todavía se puede jugar), los comodines los cubren
 * automáticamente; si no alcanzan, la racha actual es 0.
 */
export function rachaEfectiva(
  racha: PalabraRacha,
  hoy: string
): { racha: PalabraRacha; comodinesUsados: number } {
  if (!racha.ultimaFecha) return { racha: { ...racha }, comodinesUsados: 0 };
  const faltados = Math.max(0, diasEntre(racha.ultimaFecha, hoy) - 1);
  if (faltados === 0) return { racha: { ...racha }, comodinesUsados: 0 };
  if (faltados <= racha.comodines) {
    return { racha: { ...racha, comodines: racha.comodines - faltados }, comodinesUsados: faltados };
  }
  return { racha: { ...racha, actual: 0, comodines: 0 }, comodinesUsados: 0 };
}

// ---------- Estadísticas ----------

export function calcularEstadisticas(
  partidas: Array<{ terminada: boolean; resuelta: boolean; numIntentos: number }>
): PalabraEstadisticas {
  const terminadas = partidas.filter((p) => p.terminada);
  const distribucion = Array.from({ length: PALABRA_MAX_INTENTOS }, () => 0);
  let ganadas = 0;
  for (const p of terminadas) {
    if (p.resuelta && p.numIntentos >= 1 && p.numIntentos <= PALABRA_MAX_INTENTOS) {
      ganadas += 1;
      distribucion[p.numIntentos - 1] += 1;
    }
  }
  return {
    jugadas: terminadas.length,
    ganadas,
    porcentaje: terminadas.length ? Math.round((ganadas / terminadas.length) * 100) : 0,
    distribucion,
  };
}

// ---------- Pistas ----------

export const NOMBRE_CATEGORIA: Record<PalabraCategoria, string> = {
  persona: "Persona",
  lugar: "Lugar",
  objeto: "Objeto",
  accion: "Acción",
  concepto: "Concepto",
};

export const CATEGORIAS_PALABRA = Object.keys(NOMBRE_CATEGORIA) as PalabraCategoria[];

export function esCategoria(valor: unknown): valor is PalabraCategoria {
  return typeof valor === "string" && (CATEGORIAS_PALABRA as string[]).includes(valor);
}

/** Intentos fallidos de una partida (el que la resolvió no cuenta). */
export function intentosFallidos(numIntentos: number, resuelta: boolean): number {
  return resuelta ? Math.max(numIntentos - 1, 0) : numIntentos;
}

/** La segunda pista (libro y capítulo) aparece tras este número de intentos fallidos. */
export function tieneSegundaPista(numIntentos: number, resuelta: boolean): boolean {
  return intentosFallidos(numIntentos, resuelta) >= PALABRA_FALLOS_SEGUNDA_PISTA;
}

/**
 * Segunda pista: "Búscala en Mateo 6". Nunca puede contener la respuesta:
 * si el libro ES la palabra (ESTER en Ester, ÉXODO en Éxodo…) solo dice
 * que es el nombre de un libro y de qué Testamento.
 */
export function pistaCapitulo(libro: string, capitulo: number, palabra: string): string {
  const respuesta = normalizarPalabra(palabra);
  const libroNormalizado = normalizarPalabra(libro).replace(/^\d+\s*/, "");
  const testamento = buscarLibro(libro)?.testamento ?? "Antiguo";
  const pista = `Búscala en ${libro} ${capitulo}`;
  return libroNormalizado.includes(respuesta) || normalizarPalabra(pista).includes(respuesta)
    ? `Es el nombre de un libro del ${testamento} Testamento`
    : pista;
}

// ---------- Compartir ----------

const EMOJI: Record<PalabraColor, string> = { correct: "🟩", present: "🟨", absent: "⬛" };

/** Texto para compartir: cuadrícula de emojis, sin revelar la palabra. */
export function textoParaCompartir(opciones: {
  fecha: string;
  intentos: PalabraIntento[];
  resuelta: boolean;
  racha: number;
  pistaUsada?: boolean;
}): string {
  const marcador =
    (opciones.resuelta ? String(opciones.intentos.length) : "X") + `/${PALABRA_MAX_INTENTOS}` + (opciones.pistaUsada ? " 💡" : "");
  const cuadricula = opciones.intentos.map((i) => i.colores.map((c) => EMOJI[c]).join("")).join("\n");
  return [
    `Palabra del Día Elim #${numeroDelDia(opciones.fecha)}  ${marcador}  🔥 Racha: ${opciones.racha}`,
    cuadricula,
    PALABRA_URL_COMPARTIR,
  ].join("\n");
}
