// src/lib/ingles/pronunciacion-prompts.ts
// Instrucciones para el modo Pronunciación: generar frases y explicar errores.

import type { InglesNivel, InglesSonido, PronPalabra } from "@/types";
import { ETIQUETA_SONIDO } from "./etiquetas";
import { UMBRAL_FONEMA } from "./sonidos";

const SONIDOS: InglesSonido[] = ["th", "v_b", "sh_ch", "r", "vocales", "s_inicial"];

const NIVEL_FRASES: Record<InglesNivel, string> = {
  principiante: "PRINCIPIANTE (A1-A2): vocabulario muy básico y cotidiano, frases de 5 a 7 palabras, presente simple.",
  intermedio: "INTERMEDIO (B1-B2): vocabulario común, frases de 7 a 10 palabras, tiempos variados.",
  avanzado: "AVANZADO (C1-C2): vocabulario más rico, frases de 9 a 12 palabras, algún phrasal verb o expresión natural.",
};

export const SISTEMA_FRASES = `Eres la tutora de pronunciación de "Elim English", en una plataforma cristiana (Iglesia La Luz del Mundo). Generas frases en inglés para que hispanohablantes practiquen pronunciación en voz alta.

Reglas:
- Cada frase tiene entre 5 y 12 palabras, es natural y de la vida diaria, con contenido respetuoso.
- Cada frase se enfoca en UN sonido difícil para hispanohablantes, de esta lista (usa la clave exacta):
${SONIDOS.map((s) => `  - "${s}": ${ETIQUETA_SONIDO[s]}`).join("\n")}
- Varía los sonidos entre las frases.
- Sin números escritos con cifras, sin abreviaturas, sin comillas dentro de la frase.
- Responde SOLO con un arreglo JSON, sin texto antes ni después, con este formato:
[{"texto": "frase en inglés", "traduccion": "traducción natural al español", "sonido": "th"}]`;

export function pedidoFrases(nivel: InglesNivel, cantidad: number, recientes: string[]): string {
  const evitar = recientes.length
    ? `\n\nNo repitas ni parafrasees estas frases que el alumno ya practicó:\n${recientes.map((f) => `- ${f}`).join("\n")}`
    : "";
  return `Genera ${cantidad} frases para nivel ${NIVEL_FRASES[nivel]}${evitar}`;
}

export interface FraseGenerada {
  texto: string;
  traduccion: string;
  sonido: InglesSonido | null;
}

/** Extrae y valida las frases del texto del modelo (descarta las que no cumplan). */
export function leerFrases(respuesta: string): FraseGenerada[] {
  const inicio = respuesta.indexOf("[");
  const fin = respuesta.lastIndexOf("]");
  if (inicio < 0 || fin <= inicio) return [];
  let crudo: unknown;
  try {
    crudo = JSON.parse(respuesta.slice(inicio, fin + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(crudo)) return [];

  const frases: FraseGenerada[] = [];
  for (const item of crudo as Record<string, unknown>[]) {
    const texto = typeof item?.texto === "string" ? item.texto.trim() : "";
    const traduccion = typeof item?.traduccion === "string" ? item.traduccion.trim() : "";
    const palabras = texto.split(/\s+/).filter(Boolean).length;
    if (!texto || !traduccion || palabras < 4 || palabras > 14 || texto.length > 200 || traduccion.length > 300) continue;
    const sonido = SONIDOS.includes(item.sonido as InglesSonido) ? (item.sonido as InglesSonido) : null;
    frases.push({ texto, traduccion, sonido });
  }
  return frases;
}

export const SISTEMA_EXPLICACION = `Eres la tutora de pronunciación de "Elim English". Recibes el resultado de una evaluación automática de pronunciación de un alumno hispanohablante y le explicas en ESPAÑOL qué mejorar.

Reglas:
- Máximo 3 correcciones, empezando por la más importante. Para cada una: la palabra, qué sonido falló y cómo colocar la boca, los labios o la lengua para corregirlo (por ejemplo, para "th": la punta de la lengua entre los dientes y soplar suave).
- Tono cálido que anime; nunca regañes.
- Si el puntaje general es 85 o más, felicítalo, menciona como mucho un detalle pequeño y sugiérele pasar a la siguiente frase.
- Si omitió palabras, dile cuáles faltaron.
- Sé breve: máximo 90 palabras. Sin títulos ni tablas; puedes usar una lista corta.
- No inventes errores que no estén en los datos.`;

export function pedidoExplicacion(
  texto: string,
  nivel: InglesNivel,
  r: { puntaje: number; precision: number; fluidez: number; completitud: number; palabras: PronPalabra[] },
): string {
  const conError = r.palabras
    .filter((p) => p.error !== "None" || p.puntaje < 80)
    .map((p) => {
      const fonemas = p.fonemas
        .filter((f) => f.puntaje < UMBRAL_FONEMA)
        .map((f) => `${f.fonema} (${Math.round(f.puntaje)})`)
        .join(", ");
      const tipo = p.error === "Omission" ? "OMITIDA" : p.error === "Insertion" ? "AGREGADA (no estaba en la frase)" : `puntaje ${Math.round(p.puntaje)}`;
      return `- "${p.palabra}": ${tipo}${fonemas ? `; fonemas débiles (alfabeto SAPI): ${fonemas}` : ""}`;
    });

  return `Frase: "${texto}"
Nivel del alumno: ${nivel}
Puntaje general: ${Math.round(r.puntaje)}/100 (precisión ${Math.round(r.precision)}, fluidez ${Math.round(r.fluidez)}, completitud ${Math.round(r.completitud)})
Palabras con problemas:
${conError.length ? conError.join("\n") : "- ninguna"}`;
}
