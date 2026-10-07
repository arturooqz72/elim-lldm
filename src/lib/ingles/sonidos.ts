// src/lib/ingles/sonidos.ts
// Traduce los fonemas que Azure marca como mal pronunciados (alfabeto SAPI
// de en-US, el que usa por defecto) a los sonidos difíciles para
// hispanohablantes que seguimos en el progreso.

import type { InglesSonido, PronPalabra } from "@/types";

/** Debajo de este puntaje un fonema cuenta como fallado. */
export const UMBRAL_FONEMA = 60;

const POR_FONEMA: Record<string, InglesSonido> = {
  th: "th", // think
  dh: "th", // this
  v: "v_b",
  b: "v_b",
  sh: "sh_ch",
  ch: "sh_ch",
  r: "r",
  er: "r", // bird, car (r final)
  ih: "vocales", // ship
  iy: "vocales", // sheep
  uh: "vocales", // full
  uw: "vocales", // fool
  ae: "vocales", // cat
  ah: "vocales", // cut
};

/** school, speak, star…: la s seguida de consonante al inicio de la palabra. */
const S_INICIAL = /^s[cklmnptw]/i;

/** Sonidos fallados en un intento (sin repetir), en el orden en que aparecen. */
export function sonidosFallados(palabras: PronPalabra[]): InglesSonido[] {
  const encontrados = new Set<InglesSonido>();
  for (const p of palabras) {
    if (p.error === "Insertion") continue;
    p.fonemas.forEach((f, i) => {
      if (f.puntaje >= UMBRAL_FONEMA) return;
      if (i === 0 && f.fonema === "s" && S_INICIAL.test(p.palabra)) {
        encontrados.add("s_inicial");
        return;
      }
      const sonido = POR_FONEMA[f.fonema];
      if (sonido) encontrados.add(sonido);
    });
  }
  return [...encontrados];
}

/** Color de una palabra según su puntaje (verde bien, amarillo regular, rojo mal). */
export function nivelPalabra(p: Pick<PronPalabra, "puntaje" | "error">): "bien" | "regular" | "mal" {
  if (p.error === "Omission") return "mal";
  if (p.puntaje >= 80) return "bien";
  if (p.puntaje >= 60) return "regular";
  return "mal";
}
