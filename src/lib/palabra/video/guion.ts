// src/lib/palabra/video/guion.ts
//
// Guion de la voz del video de TikTok (ElevenLabs). Siempre empieza con
// "La paz del Señor" y termina con "Dios los bendiga". Quien no dio
// permiso de TikTok es "un hermano participante". El admin lo puede
// editar antes de generar la voz; las frases de MARCAS son las que abren
// cada escena del video (ver sincronia.ts).
import type { PalabraTarjetaTikTok } from "@/types";
import { NOMBRE_SIN_PERMISO } from "../puntos";

export const SIN_PERMISO_VOZ = "un hermano participante";
/** Tope del guion editado (el de siempre ronda los 350). */
export const MAX_GUION = 1200;

/** "GRACIA" → "Gracia": en mayúsculas la voz podría deletrearla. */
function paraLeer(palabra: string): string {
  const p = palabra.toLocaleLowerCase("es-MX");
  return p.charAt(0).toLocaleUpperCase("es-MX") + p.slice(1);
}

/** Cierra la oración sin duplicar el punto de un nombre corto ("Luis R."). */
const conPunto = (s: string) => (s.endsWith(".") ? s : `${s}.`);

/** Quien va adelante en la semana; null si nadie sumó puntos. */
export function liderSemana(t: PalabraTarjetaTikTok): string | null {
  const primero = t.top3Semana[0];
  if (primero?.posicion === 1 && primero.nombre !== NOMBRE_SIN_PERMISO) return primero.nombre;
  return t.top3Semana.length + t.otrosSemana > 0 ? SIN_PERMISO_VOZ : null;
}

export function guionDelDia(t: PalabraTarjetaTikTok): string {
  const g = t.ganador;
  const partes: string[] = ["La paz del Señor."];

  partes.push(g ? "¡Ya tenemos ganador de la Palabra del Día!" : "¡Aquí está la Palabra del Día!");
  if (t.palabra) partes.push(`La palabra de ayer fue ${paraLeer(t.palabra.palabra)}.`);

  if (g) {
    const nombre = t.ganadorConPermiso ? g.nombre : SIN_PERMISO_VOZ;
    const como = g.intentos === 1 ? "al primer intento" : `en solo ${g.intentos} intentos`;
    partes.push(`Felicidades a ${nombre}, que la descubrió ${como}.`, "¡Excelente!");
  } else {
    partes.push("Nadie la descubrió esta vez.");
  }

  const lider = liderSemana(t);
  if (lider) partes.push(conPunto(`Y en la semana, quien va adelante es ${lider}`), "¿Quién lo alcanzará?");

  // Corto: el cierre del video dura 4 s como máximo.
  partes.push("Juega hoy en elimlldm punto net.", "Dios los bendiga.");
  return partes.join(" ");
}

/**
 * Frase con la que empieza cada escena (sin acentos ni mayúsculas, ver
 * normalizar); se usa la que aparezca primero. La primera escena siempre
 * empieza al inicio del guion.
 */
export const MARCAS = {
  ganador: ["felicidades", "nadie la"],
  top3: ["excelente"],
  semana: ["y en la semana", "en la semana", "esta semana"],
  cierre: ["juega hoy", "juega en", "elimlldm"],
} as const;

/** Signos que abren una frase: el corte va antes de ellos ("¡Excelente!"). */
export const ABREN_FRASE = "¡¿\"'(«";

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
