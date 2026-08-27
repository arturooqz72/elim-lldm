import "server-only";

import type { RuletaBoardTile } from "@/types";

const ACCENT_MAP: Record<string, string> = {
  "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ü": "U",
};

export function deaccent(ch: string): string {
  return ACCENT_MAP[ch] || ch;
}

export function normalize(str: string): string {
  return str.toUpperCase();
}

const LETTER_RE = /[A-ZÑÁÉÍÓÚÜ]/;

export function buildBoardShape(frase: string, letrasProbadas: string[]): RuletaBoardTile[] {
  const tiles: RuletaBoardTile[] = [];
  for (const ch of frase) {
    if (!LETTER_RE.test(ch)) {
      tiles.push({ type: "space", char: ch });
      continue;
    }
    tiles.push({
      type: "letter",
      char: letrasProbadas.includes(deaccent(ch)) ? ch : null,
    });
  }
  return tiles;
}

export function countLetterInPhrase(frase: string, letra: string): number {
  let count = 0;
  for (const ch of frase) if (deaccent(ch) === letra) count++;
  return count;
}

export function isPhraseSolved(frase: string, letrasProbadas: string[]): boolean {
  for (const ch of frase) {
    if (LETTER_RE.test(ch) && !letrasProbadas.includes(deaccent(ch))) return false;
  }
  return true;
}

/** Every distinct letter actually in the phrase — used to reveal it fully on "resolver panel". */
export function allLettersInPhrase(frase: string): string[] {
  const set = new Set<string>();
  for (const ch of frase) if (LETTER_RE.test(ch)) set.add(deaccent(ch));
  return [...set];
}

export interface JugadorOrden {
  id: string;
  orden: number;
}

export function nextJugadorId(jugadores: JugadorOrden[], currentId: string): string {
  const sorted = [...jugadores].sort((a, b) => a.orden - b.orden);
  const idx = sorted.findIndex((j) => j.id === currentId);
  const next = sorted[(idx + 1) % sorted.length];
  return next.id;
}
