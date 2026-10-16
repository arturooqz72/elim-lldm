// src/lib/palabra/puntos.ts
// Puntos de la Palabra del Día: las mismas reglas que las funciones de
// ranking en SQL (0066): 7 menos los intentos usados si la resolvió, 0 si
// no. Sin descuento por pista ni por tiempo (el tiempo solo desempata).
import { PALABRA_INICIO_PISTAS } from "./config";
import { tieneSegundaPista } from "./logica";

export function puntosDe(numIntentos: number, resuelta: boolean): number {
  return resuelta ? Math.max(7 - numIntentos, 0) : 0;
}

/**
 * Si vio una pista. Desde PALABRA_INICIO_PISTAS la del capítulo sale sola
 * después del 2.º intento fallido (la categoría la ven todos, no cuenta);
 * antes se pedía con un botón y quedaba en pista_usada.
 */
export function vioPista(fecha: string, numIntentos: number, resuelta: boolean, pistaUsada: boolean): boolean {
  return fecha < PALABRA_INICIO_PISTAS ? pistaUsada : tieneSegundaPista(numIntentos, resuelta);
}

/** Nombre en la tarjeta de TikTok de quien no dio permiso. */
export const NOMBRE_SIN_PERMISO = "Hermano/a participante";

/** Partículas que no cuentan como apellido: "María de la Luz Pérez" → "María P.". */
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "da", "do", "dos", "van", "von"]);

/**
 * Nombre para TikTok: primer nombre + inicial del apellido ("Arturo O.").
 * El nombre para mostrar muchas veces es el nombre completo que viene de
 * Google; en un video público solo va esta forma corta.
 */
export function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "Jugador";
  const apellido = partes.slice(1).find((p) => !PARTICULAS.has(p.toLowerCase()));
  const inicial = apellido ? [...apellido][0]?.toLocaleUpperCase("es") : null;
  return inicial ? `${partes[0]} ${inicial}.` : partes[0];
}

/** Días que se deja de preguntar por TikTok después de un "No, gracias". */
export const TIKTOK_PAUSA_DIAS = 7;

/**
 * Si se le muestra la tarjeta "¿Quieres aparecer en nuestro TikTok?". No
 * hace falta columna nueva: tiktok_permiso_at (0078) guarda cuándo
 * contestó por última vez, y si sigue sin permiso es que dijo que no (con
 * la tarjeta o desmarcando la casilla).
 */
export function debePreguntarTikTok(permiso: boolean, contestoEn: string | null, ahora = Date.now()): boolean {
  if (permiso) return false;
  if (!contestoEn) return true;
  const contesto = Date.parse(contestoEn);
  return Number.isNaN(contesto) || ahora - contesto >= TIKTOK_PAUSA_DIAS * 24 * 60 * 60 * 1000;
}
