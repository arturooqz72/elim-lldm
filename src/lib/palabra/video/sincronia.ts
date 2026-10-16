// src/lib/palabra/video/sincronia.ts
//
// Plan de sonido del video de TikTok: cuánto dura cada escena, en qué
// segundo del video suena cada tramo de la voz y cómo sube y baja la
// música. Cada escena empieza cuando la voz dice su frase (MARCAS en
// guion.ts), con los tiempos por carácter que devuelve ElevenLabs. Si la
// frase de una escena es más corta que lo que la animación necesita, la
// voz espera con la música sola; así nunca se corta ni se adelanta.
//
//   música fuerte ─┐                                     ┌─ fuerte ─╲ fade out
//                  └── baja mientras habla la voz ───────┘
//   |INTRO| palabra | ganador | top 3 | semana | cierre |  OUTRO   |
import type { PalabraVozAlineacion } from "@/types";
import { ABREN_FRASE, MARCAS, normalizar } from "./guion";
import type { Escena, IdEscena } from "./escenas";

/** Segundos de música sola antes de que empiece a hablar. */
export const INTRO = 1.6;
/** Segundos de música después de "Dios los bendiga" (el último con fade out). */
export const OUTRO = 3.2;
const FADE_OUT = 2.4;

/** Lo menos que dura cada escena para que su animación se alcance a ver. */
const MINIMO: Record<IdEscena, number> = { palabra: 4.2, ganador: 3.8, top3: 3.2, semana: 3.4, cierre: 3 };

const VOLUMEN = { fuerte: 0.6, conVoz: 0.17, pausa: 0.32 } as const;
const RAMPA = 0.35;

/** Un pedazo de la voz: suena [desde, hasta) del MP3 en el segundo `enVideo`. */
export interface TramoVoz {
  enVideo: number;
  desde: number;
  hasta: number;
}

export interface PlanSonido {
  duraciones: Partial<Record<IdEscena, number>>;
  tramos: TramoVoz[];
  /** Volumen de la música: [segundo, volumen], con rampas lineales entre puntos. */
  musica: Array<[number, number]>;
  dura: number;
}

/** Segundo de la voz en que empieza cada escena (null si su frase no está en el guion). */
function marcas(ids: IdEscena[], al: PalabraVozAlineacion): Array<number | null> {
  // Carácter por carácter, para que cada posición siga siendo la misma de la alineación.
  const texto = al.characters.map((c) => normalizar(c).charAt(0) || c).join("");
  let desdeIndice = 0;
  return ids.map((id, i) => {
    if (i === 0) return 0;
    const frases = MARCAS[id as keyof typeof MARCAS] ?? [];
    const encontrados = frases.map((f) => texto.indexOf(f, desdeIndice)).filter((x) => x >= 0);
    if (encontrados.length === 0) return null;
    let indice = Math.min(...encontrados);
    desdeIndice = indice + 1;
    while (indice > 0 && ABREN_FRASE.includes(texto[indice - 1])) indice--;
    return al.character_start_times_seconds[indice] ?? null;
  });
}

function volumenMusica(tramos: TramoVoz[], dura: number): Array<[number, number]> {
  const puntos: Array<[number, number]> = [[0, 0], [0.4, VOLUMEN.fuerte]];
  // Nunca antes del punto anterior: las rampas tienen que ir hacia adelante.
  const poner = (t: number, v: number) => puntos.push([Math.max(t, puntos[puntos.length - 1][0]), v]);
  const actual = () => puntos[puntos.length - 1][1];

  tramos.forEach((tr, i) => {
    const fin = tr.enVideo + (tr.hasta - tr.desde);
    poner(tr.enVideo - RAMPA, actual());
    poner(tr.enVideo, VOLUMEN.conVoz);
    const siguiente = tramos[i + 1];
    // En las pausas largas (la voz espera a la animación) la música sube un poco.
    if (siguiente && siguiente.enVideo - fin > 1.2) {
      poner(fin, VOLUMEN.conVoz);
      poner(fin + RAMPA, VOLUMEN.pausa);
    }
  });
  const ultimo = tramos[tramos.length - 1];
  if (ultimo) {
    const fin = ultimo.enVideo + (ultimo.hasta - ultimo.desde);
    poner(fin, VOLUMEN.conVoz);
    poner(fin + 0.6, VOLUMEN.fuerte);
  }
  poner(dura - FADE_OUT, VOLUMEN.fuerte);
  poner(dura, 0);
  return puntos;
}

/** Con voz: las escenas se ajustan a lo que va diciendo. */
export function planConVoz(ids: IdEscena[], al: PalabraVozAlineacion, duraVoz: number): PlanSonido {
  const m = marcas(ids, al);
  const finVoz = Math.min(duraVoz, (al.character_end_times_seconds.at(-1) ?? duraVoz) + 0.25);
  const duraciones: Partial<Record<IdEscena, number>> = {};
  const tramos: TramoVoz[] = [];
  let inicio = 0;

  ids.forEach((id, i) => {
    const desde = m[i];
    // Termina donde empieza la siguiente escena que sí se encontró en la voz.
    const hasta = m.slice(i + 1).find((x): x is number => x !== null) ?? finVoz;
    const largo = desde === null ? 0 : Math.max(hasta - desde, 0);
    const primera = i === 0;
    const ultima = i === ids.length - 1;
    const enVideo = inicio + (primera ? INTRO : 0);
    if (desde !== null && largo > 0) tramos.push({ enVideo, desde, hasta });

    const conVoz = (primera ? INTRO : 0) + largo;
    duraciones[id] = ultima ? Math.max(conVoz + OUTRO, MINIMO[id]) : Math.max(conVoz, MINIMO[id]);
    inicio += duraciones[id]!;
  });

  return { duraciones, tramos, musica: volumenMusica(tramos, inicio), dura: inicio };
}

/** Sin voz todavía: las escenas de siempre, con la música fuerte y fade out al final. */
export function planSinVoz(escenas: Escena[]): PlanSonido {
  const ultima = escenas[escenas.length - 1];
  const dura = ultima ? ultima.inicio + ultima.dura : 0;
  return { duraciones: {}, tramos: [], musica: volumenMusica([], dura), dura };
}

/** Volumen de la música en el segundo `t` (para empezar a media canción). */
export function volumenEn(puntos: Array<[number, number]>, t: number): number {
  for (let i = 1; i < puntos.length; i++) {
    const [t1, v1] = puntos[i];
    const [t0, v0] = puntos[i - 1];
    if (t <= t1) return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return puntos[puntos.length - 1]?.[1] ?? 0;
}
