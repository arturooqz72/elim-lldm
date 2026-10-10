// src/lib/ingles/frases-chat.ts
// Frases que la tutora marca en sus respuestas para practicar con la voz:
//   [[say: How are you today?]]
// El servidor deja como mucho MAX_TARJETAS marcas válidas por respuesta y
// guarda la respuesta ya limpia; la página dibuja cada marca como tarjeta
// (🔊 Escuchar / 🎤 Dilo tú) y el servidor vuelve a leer la frase del mensaje
// guardado al evaluar, así que el texto evaluado nunca viene del navegador.
// Se usa en el cliente y en el servidor (sin dependencias).

export const MAX_TARJETAS = 2;
const MAX_LARGO = 200;
const MARCA = /\[\[say:\s*([^\]\n]*?)\s*\]\]/gi;

/** La frase sin negritas de Markdown (**…**) ni espacios de sobra. */
function limpia(frase: string): string {
  return frase.replace(/\*\*/g, "").trim();
}

/** Letras que solo aparecen en español: esa frase no se evalúa como inglés. */
const ESPANOL = /[¿¡ñÑáéíóúÁÉÍÓÚ]/;

/** Frase válida para evaluar: inglés corto, con letras y sin la marca. */
function valida(texto: string): boolean {
  return (
    texto.length >= 2 &&
    texto.length <= MAX_LARGO &&
    /[A-Za-z]/.test(texto) &&
    !/[[\]]/.test(texto) &&
    !ESPANOL.test(texto)
  );
}

/**
 * Deja como mucho MAX_TARJETAS marcas válidas; las demás (o las inválidas)
 * se quedan como texto normal, sin la marca.
 */
export function limpiarRespuesta(reply: string): string {
  let marcas = 0;
  return reply.replace(MARCA, (_completa, frase: string) => {
    const texto = limpia(frase);
    if (marcas < MAX_TARJETAS && valida(texto)) {
      marcas++;
      return `[[say: ${texto}]]`;
    }
    return texto;
  });
}

/** Frases marcadas de un mensaje, en orden (índice 0 y 1). */
export function frasesDe(content: string): string[] {
  const frases: string[] = [];
  for (const m of content.matchAll(MARCA)) {
    const texto = limpia(m[1]);
    if (valida(texto)) frases.push(texto);
    if (frases.length === MAX_TARJETAS) break;
  }
  return frases;
}

export type Pieza = { tipo: "texto"; texto: string } | { tipo: "frase"; texto: string; indice: number };

/** Divide un mensaje en texto normal y tarjetas, para dibujarlo. */
export function piezas(content: string): Pieza[] {
  const resultado: Pieza[] = [];
  let desde = 0;
  let indice = 0;
  for (const m of content.matchAll(MARCA)) {
    const antes = content.slice(desde, m.index);
    const texto = limpia(m[1]);
    const esTarjeta = indice < MAX_TARJETAS && valida(texto);
    if (antes) resultado.push({ tipo: "texto", texto: antes });
    resultado.push(esTarjeta ? { tipo: "frase", texto, indice: indice++ } : { tipo: "texto", texto });
    desde = (m.index ?? 0) + m[0].length;
  }
  const resto = content.slice(desde);
  if (resto) resultado.push({ tipo: "texto", texto: resto });
  return resultado;
}

/** El mensaje sin marcas (para copiar, compartir o leer en voz alta). */
export function sinMarcas(content: string): string {
  return content.replace(MARCA, (_c, frase: string) => frase.trim());
}
