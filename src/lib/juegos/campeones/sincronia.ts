// src/lib/juegos/campeones/sincronia.ts
//
// Plan de sonido del video de Campeones: igual que el de la Palabra del
// Día (palabra/video/sincronia.ts): cada escena empieza cuando la voz dice
// su frase (MARCAS) y dura lo que dura esa frase. Los mínimos son cortos
// para que la voz casi nunca espere: las pausas quedan de menos de 1 s.
import type { PalabraVozAlineacion } from "@/types";
import { ABREN_FRASE, normalizar } from "@/lib/palabra/video/guion";
import { INTRO, OUTRO, volumenMusica, type PlanSonido, type TramoVoz } from "@/lib/palabra/video/sincronia";
import { PORTADA_DURA } from "@/lib/palabra/video/portada";
import { MARCAS } from "./guion";
import type { IdEscena } from "./escenas";

const OUTRO_MINIMO = 0.4;
const MAX_CIERRE = 4;
/** Lo menos que dura cada escena para que su animación se alcance a ver. */
const MINIMO: Record<IdEscena, number> = { portada: PORTADA_DURA, inicio: 2.6, trivia: 3, ahorcado: 3, ruleta: 3, palabra: 3, cierre: 2.6 };

/** Segundo de la voz en que empieza cada escena (null si su frase no está en el guion). */
function marcas(ids: IdEscena[], al: PalabraVozAlineacion): Array<number | null> {
  const texto = al.characters.map((c) => normalizar(c).charAt(0) || c).join("");
  let desdeIndice = 0;
  return ids.map((id, i) => {
    if (i === 0) return 0;
    const frases: readonly string[] = MARCAS[id as keyof typeof MARCAS] ?? [];
    const encontrados = frases.map((f) => texto.indexOf(f, desdeIndice)).filter((x) => x >= 0);
    if (encontrados.length === 0) return null;
    let indice = Math.min(...encontrados);
    desdeIndice = indice + 1;
    while (indice > 0 && ABREN_FRASE.includes(texto[indice - 1])) indice--;
    return al.character_start_times_seconds[indice] ?? null;
  });
}

export type PlanCampeones = Omit<PlanSonido, "duraciones" | "voltear"> & { duraciones: Partial<Record<IdEscena, number>> };

export function planConVoz(todas: IdEscena[], al: PalabraVozAlineacion, duraVoz: number): PlanCampeones {
  const duraciones: Partial<Record<IdEscena, number>> = {};
  const tramos: TramoVoz[] = [];
  let inicio = 0;
  if (todas[0] === "portada") {
    duraciones.portada = PORTADA_DURA;
    inicio = PORTADA_DURA;
  }
  const ids = todas.filter((id) => id !== "portada");
  const m = marcas(ids, al);
  const finVoz = Math.min(duraVoz, (al.character_end_times_seconds.at(-1) ?? duraVoz) + 0.25);

  ids.forEach((id, i) => {
    const desde = m[i];
    const hasta = m.slice(i + 1).find((x): x is number => x !== null) ?? finVoz;
    const largo = desde === null ? 0 : Math.max(hasta - desde, 0);
    const primera = i === 0;
    const ultima = i === ids.length - 1;
    if (desde !== null && largo > 0) tramos.push({ enVideo: inicio + (primera ? INTRO : 0), desde, hasta });
    const conVoz = (primera ? INTRO : 0) + largo;
    duraciones[id] = ultima
      ? Math.max(Math.min(conVoz + OUTRO, MAX_CIERRE), conVoz + OUTRO_MINIMO, MINIMO[id])
      : Math.max(conVoz, MINIMO[id]);
    inicio += duraciones[id]!;
  });

  return { duraciones, tramos, musica: volumenMusica(tramos, inicio), dura: inicio };
}

/** Sin voz todavía: las escenas de siempre, con la música fuerte y fade out al final. */
export function planSinVoz(dura: number): PlanCampeones {
  return { duraciones: {}, tramos: [], musica: volumenMusica([], dura), dura };
}
