// src/lib/palabra/video/sincronia.ts
//
// Plan de sonido del video de TikTok: cuánto dura cada escena, en qué
// segundo del video suena cada tramo de la voz y cómo sube y baja la
// música. Cada escena empieza cuando la voz dice su frase (MARCAS en
// guion.ts), con los tiempos por carácter que devuelve ElevenLabs. Si la
// frase de una escena es más corta que lo que la animación necesita, la
// voz espera con la música sola; así nunca se corta ni se adelanta.
//
//   música fuerte ─┐                                          ┌╲ se apaga
//                  └── baja mientras habla la voz ────────────┘
//   |portada|INTRO| palabra | ganador | top 3 | semana | cierre (≤ 4 s) |
import type { PalabraVozAlineacion } from "@/types";
import { ABREN_FRASE, MARCAS, normalizar } from "./guion";
import type { Escena, IdEscena } from "./escenas";
import { PORTADA_DURA } from "./portada";

/** Segundos de música sola antes de que empiece a hablar (después de la portada). */
export const INTRO = 1.3;
/** Segundos de música después de "Dios los bendiga", mientras se apaga. */
export const OUTRO = 1;
const OUTRO_MINIMO = 0.4;
/** El cierre dura esto como máximo (salvo que la voz misma tarde más en terminar). */
const MAX_CIERRE = 4;
const FADE_OUT = 2.4;

/** Lo menos que dura cada escena para que su animación se alcance a ver. */
const MINIMO: Record<IdEscena, number> = { portada: PORTADA_DURA, palabra: 4.2, ganador: 3.8, top3: 3.2, semana: 3.4, cierre: 2.6 };

/** Las fichas empiezan a voltearse esto antes de que la voz diga la palabra. */
const ANTICIPO = 0.15;
/** Lo que sigue en la escena "palabra" después de que empiezan a voltearse las fichas. */
const TRAS_VOLTEAR = 4.2;

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
  /** Segundo de la escena "palabra" en que se voltean las fichas (cuando la voz la dice). */
  voltear?: number;
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

/** Segundo de la voz en que dice la palabra del día ("…fue mateo"); null si no la dice. */
function cuandoDice(palabra: string, al: PalabraVozAlineacion): number | null {
  const texto = al.characters.map((c) => normalizar(c).charAt(0) || c).join("");
  const p = normalizar(palabra);
  const tras = texto.indexOf(`fue ${p}`);
  const indice = tras >= 0 ? tras + 4 : texto.indexOf(p);
  return indice >= 0 ? (al.character_start_times_seconds[indice] ?? null) : null;
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
    // Cierre corto: al terminar la voz la música sube un poco y se apaga.
    const fin = ultimo.enVideo + (ultimo.hasta - ultimo.desde);
    poner(fin, VOLUMEN.conVoz);
    poner(Math.min(fin + 0.3, dura), VOLUMEN.pausa);
    poner(dura, 0);
    return puntos;
  }
  poner(dura - FADE_OUT, VOLUMEN.fuerte);
  poner(dura, 0);
  return puntos;
}

/**
 * Con voz: las escenas se ajustan a lo que va diciendo. La portada (si va)
 * dura lo de siempre y sin voz; la música ya suena desde ella.
 */
export function planConVoz(todas: IdEscena[], al: PalabraVozAlineacion, duraVoz: number, palabra?: string): PlanSonido {
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
  // Las fichas empiezan a voltearse un poquito antes de que suene la palabra.
  const dice = palabra && ids[0] === "palabra" ? cuandoDice(palabra, al) : null;
  const voltear = dice === null ? undefined : Math.max(INTRO + dice - ANTICIPO, 0.6);

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
    // Después de voltearse, que alcance a verse la cita y la explicación.
    const minimo = id === "palabra" && voltear !== undefined ? Math.max(MINIMO.palabra, voltear + TRAS_VOLTEAR) : MINIMO[id];
    duraciones[id] = ultima
      ? Math.max(Math.min(conVoz + OUTRO, MAX_CIERRE), conVoz + OUTRO_MINIMO, minimo)
      : Math.max(conVoz, minimo);
    inicio += duraciones[id]!;
  });

  return { duraciones, voltear, tramos, musica: volumenMusica(tramos, inicio), dura: inicio };
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
