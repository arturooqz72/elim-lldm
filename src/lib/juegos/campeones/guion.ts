// src/lib/juegos/campeones/guion.ts
//
// Guion de la voz del video "Campeones de la semana" (ElevenLabs). Siempre
// empieza con "La paz del Señor" y termina con "Dios los bendiga". Quien no
// dio permiso de TikTok es "un hermano participante". El admin lo puede
// editar antes de generar; las frases de MARCAS abren cada escena.
import type { CampeonesFila, CampeonesJuego, CampeonesPersonaPalabra, CampeonesSemana } from "@/types";
import { SIN_PERMISO_VOZ, nombreParaVoz } from "@/lib/palabra/video/guion";

/** Cierra la oración sin duplicar el punto de un nombre corto ("Luis R."). */
const conPunto = (s: string) => (s.endsWith(".") ? s : `${s}.`);
const nombreVoz = (p: { nombre: string; conPermiso: boolean }) => (p.conPermiso ? nombreParaVoz(p.nombre) : SIN_PERMISO_VOZ);

/** Cómo empieza la frase de cada juego (las MARCAS la buscan). */
const ABRE: Record<CampeonesJuego["id"], string> = {
  trivia: "En la Trivia en línea, el campeón es",
  ahorcado: "En el Ahorcado, el campeón es",
  ruleta: "En la Ruleta en línea, el primer lugar es para",
};

function siguen(resto: CampeonesFila[]): string | null {
  if (resto.length === 0) return null;
  const sinPermiso = resto.filter((p) => !p.conPermiso).length;
  if (resto.length === 2 && sinPermiso === 2) return "Le siguen dos hermanos participantes.";
  const nombres = resto.map(nombreVoz);
  return conPunto(resto.length === 1 ? `Le sigue ${nombres[0]}` : `Le siguen ${nombres[0]} y ${nombres[1]}`);
}

function fraseJuego(j: CampeonesJuego): string {
  const [primero, ...resto] = j.podio;
  const partes = [`${ABRE[j.id]} ${nombreVoz(primero)}, con ${primero.puntos} puntos.`];
  const s = siguen(resto);
  if (s) partes.push(s);
  return partes.join(" ");
}

function frasePalabra(racha: CampeonesPersonaPalabra, masDias: CampeonesPersonaPalabra): string {
  const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
  const misma = racha.conPermiso && masDias.conPermiso && racha.nombre === masDias.nombre;
  if (misma) {
    return `En la Palabra del Día, ${racha.nombre} tiene la mejor racha, con ${dias(racha.valor)} seguidos, y la resolvió ${dias(masDias.valor)} de siete.`;
  }
  return `En la Palabra del Día, la mejor racha es de ${nombreVoz(racha)}, con ${dias(racha.valor)} seguidos. Y quien la resolvió más días fue ${nombreVoz(masDias)}: ${masDias.valor} de siete.`;
}

export function guionSemana(c: CampeonesSemana): string {
  const partes = ["La paz del Señor.", "¡Estos son los campeones de la semana en los juegos de Elim LLDM!"];
  for (const j of c.juegos) partes.push(fraseJuego(j));
  if (c.palabra) partes.push(frasePalabra(c.palabra.racha, c.palabra.masDias));
  // "Felicidades" va al final de la última escena: el cierre dura 4 s como máximo.
  partes.push("¡Felicidades a todos!", "¿Te animas a jugar esta semana? Entra a elim l l d m punto net.", "Dios los bendiga.");
  return partes.join(" ");
}

/**
 * Frase con la que empieza cada escena (sin acentos ni mayúsculas, ver
 * normalizar en palabra/video/guion.ts). La primera escena empieza con la voz.
 */
export const MARCAS = {
  trivia: ["en la trivia"],
  ahorcado: ["en el ahorcado"],
  ruleta: ["en la ruleta"],
  palabra: ["en la palabra del dia"],
  cierre: ["te animas", "juega", "entra a"],
} as const;
