export interface Puzzle {
  category: string;
  phrase: string;
}

// Real subset of the puzzle bank already used by the single-device game
// (public/juegos/ruleta-elimlldm.html, DEFAULT_DATA.puzzles).
export const PUZZLES: Puzzle[] = [
  { category: "Saludo Cristiano", phrase: "LA PAZ DE CRISTO SEA CON USTEDES" },
  { category: "Saludo Cristiano", phrase: "LA GRACIA DE DIOS SEA CON TODOS" },
  { category: "Saludo Cristiano", phrase: "BENDICIONES PARA TODA LA FAMILIA" },
  { category: "Saludo Cristiano", phrase: "QUE DIOS TE BENDIGA HOY Y SIEMPRE" },
  { category: "Versiculo Biblico", phrase: "DIOS ES AMOR" },
  { category: "Versiculo Biblico", phrase: "EL SEÑOR ES MI PASTOR NADA ME FALTARA" },
  { category: "Versiculo Biblico", phrase: "DE TAL MANERA AMO DIOS AL MUNDO" },
  { category: "Versiculo Biblico", phrase: "BUSCAD PRIMERAMENTE EL REINO DE DIOS" },
  { category: "Mandamiento", phrase: "AMARAS A TU PROJIMO COMO A TI MISMO" },
  { category: "Mandamiento", phrase: "HONRA A TU PADRE Y A TU MADRE" },
  { category: "Mandamiento", phrase: "NO TOMARAS EL NOMBRE DE DIOS EN VANO" },
  { category: "Mandamiento", phrase: "NO HURTARAS" },
  { category: "Fruto del Espiritu", phrase: "AMOR GOZO PAZ PACIENCIA" },
  { category: "Fruto del Espiritu", phrase: "GOZO Y PAZ EN EL ESPIRITU" },
  { category: "Fruto del Espiritu", phrase: "TEMPLANZA Y DOMINIO PROPIO" },
  { category: "Personaje Biblico", phrase: "MOISES LIBERTADOR DE ISRAEL" },
  { category: "Personaje Biblico", phrase: "DAVID EL REY PASTOR" },
  { category: "Personaje Biblico", phrase: "NOE Y EL DILUVIO" },
  { category: "Personaje Biblico", phrase: "DANIEL EN EL FOSO DE LOS LEONES" },
  { category: "Libro de la Biblia", phrase: "EL LIBRO DE LOS SALMOS" },
  { category: "Libro de la Biblia", phrase: "EL APOCALIPSIS DE JUAN" },
  { category: "Libro de la Biblia", phrase: "EL GENESIS PRINCIPIO DE TODO" },
  { category: "Enseñanza de Jesus", phrase: "BIENAVENTURADOS LOS MANSOS" },
  { category: "Enseñanza de Jesus", phrase: "YO SOY EL CAMINO LA VERDAD Y LA VIDA" },
  { category: "Enseñanza de Jesus", phrase: "VELAD Y ORAD" },
  { category: "Historia Biblica", phrase: "EL ARCA DE NOE" },
  { category: "Historia Biblica", phrase: "DAVID Y GOLIAT" },
  { category: "Historia Biblica", phrase: "LA CREACION DEL MUNDO" },
  { category: "Historia Biblica", phrase: "LA CAIDA DE JERICO" },
  { category: "Frase de Fe", phrase: "TODO LO PUEDO EN CRISTO QUE ME FORTALECE" },
  { category: "Frase de Fe", phrase: "CON DIOS TODO ES POSIBLE" },
  { category: "Nombre de Dios", phrase: "EL BUEN PASTOR" },
  { category: "Nombre de Dios", phrase: "EL REY DE REYES" },
];

export function phraseKey(p: Puzzle): string {
  return p.category + "||" + p.phrase;
}

/**
 * Picks a phrase that hasn't been used since the pool last fully cycled,
 * preferring a different category than the last one — ported from
 * pickPuzzleIndex() in the static HTML. Returns the chosen puzzle and the
 * updated used-keys list to persist on the sala row.
 */
export function pickPuzzle(
  usedKeys: string[],
  lastCategory: string | null
): { puzzle: Puzzle; usedKeys: string[] } {
  let available = PUZZLES.filter((p) => !usedKeys.includes(phraseKey(p)));
  let baseUsed = usedKeys;
  if (available.length === 0) {
    available = PUZZLES;
    baseUsed = [];
  }

  const preferred = available.filter((p) => p.category !== lastCategory);
  const pool = preferred.length > 0 ? preferred : available;
  const choice = pool[Math.floor(Math.random() * pool.length)];

  return { puzzle: choice, usedKeys: [...baseUsed, phraseKey(choice)] };
}
