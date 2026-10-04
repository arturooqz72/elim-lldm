// src/lib/palabra/config.ts
//
// Constantes de "Palabra del Día". Sin "server-only": las usa también el
// cliente (cuenta regresiva, número del día, texto para compartir).

/** La palabra cambia a medianoche en esta zona horaria, para todos. */
export const PALABRA_TZ = "America/Los_Angeles";

export const PALABRA_LONGITUD = 5;
export const PALABRA_MAX_INTENTOS = 6;

/** Fecha del reto #1 (el número que aparece al compartir). */
export const PALABRA_EPOCH = "2026-10-03";

/** Se gana un comodín por cada N días seguidos jugados… */
export const PALABRA_DIAS_POR_COMODIN = 7;
/** …y se pueden tener guardados como máximo estos. */
export const PALABRA_MAX_COMODINES = 2;

/**
 * Al iniciar sesión, las partidas jugadas sin sesión de los últimos N días
 * se suben a la cuenta (cuentan para racha y estadísticas, no para puntos
 * del ranking). Acotado para que no se pueda inventar un historial largo.
 */
export const PALABRA_DIAS_SINCRONIZABLES = 30;

/** /admin/palabra avisa si quedan menos de estos días con palabra programada. */
export const PALABRA_AVISO_DIAS = 14;

/**
 * Puntos que resta la pista en el ranking del día (mínimo 1 si la resuelve).
 * Debe coincidir con el 2 de las funciones de ranking en 0056_palabra_pista.sql.
 */
export const PALABRA_COSTO_PISTA = 2;

export const PALABRA_URL_COMPARTIR = "elimlldm.net/juegos/palabra";
