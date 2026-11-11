// src/lib/liga/config.ts
//
// Reglas de puntos de la Liga. Cambiar aquí cambia la Liga y la página
// /reglas; la base solo aplica los topes que se le pasan desde aquí.
import { PALABRA_MAX_INTENTOS } from "@/lib/palabra/config";

export type JuegoLiga = "palabra" | "trivia" | "ruleta" | "ahorcado";

export const LIGA_PUNTOS = {
  palabraBase: 10,
  palabraPorIntentoSobrante: 2,
  triviaPorCorrecta: 1,
  ruletaPorLetra: 1,
  ruletaPorResolver: 5,
  ahorcadoPorPalabra: 2,
} as const;

/** Máximo por partida; null = sin máximo por partida (solo el tope diario). */
export const LIGA_MAX_POR_PARTIDA: Record<JuegoLiga, number | null> = {
  palabra: null,
  trivia: 20,
  ruleta: 20,
  ahorcado: null,
};

export const LIGA_TOPE_DIARIO = 40;
export const LIGA_DIAS_CAMBIO = 30;
export const LIGA_REFRESCO_MS = 30_000;
export const LIGA_URL = "https://www.elimlldm.net/juegos/liga";

/** Debe coincidir con el CHECK iglesias_forma de 0086. */
export const DENOMINACIONES = [
  "Católica",
  "Bautista",
  "Pentecostal",
  "Adventista",
  "Evangélica",
  "Otra cristiana",
  "Otra religión",
] as const;
export type Denominacion = (typeof DENOMINACIONES)[number];

export function esDenominacion(valor: unknown): valor is Denominacion {
  return typeof valor === "string" && (DENOMINACIONES as readonly string[]).includes(valor);
}

export function puntosPalabraLiga(numIntentos: number): number {
  const sobrantes = Math.max(0, PALABRA_MAX_INTENTOS - numIntentos);
  return LIGA_PUNTOS.palabraBase + LIGA_PUNTOS.palabraPorIntentoSobrante * sobrantes;
}

/** `equipoEnFrase` ya viene con artículo si es LLDM ("la Iglesia de Las Vegas"). */
export function textoInvitacion(equipoEnFrase: string | null): string {
  return equipoEnFrase
    ? `Ayuda a ${equipoEnFrase} a ganar la Liga de Elim LLDM 🏆 juega aquí: ${LIGA_URL}`
    : `Juega en la Liga de Iglesias de Elim LLDM 🏆 y suma puntos para tu equipo: ${LIGA_URL}`;
}
