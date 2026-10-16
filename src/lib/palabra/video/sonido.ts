// src/lib/palabra/video/sonido.ts
//
// Voz + canción de fondo del video de TikTok con Web Audio. La misma
// función toca el sonido de la vista previa (a las bocinas) y el que se
// mezcla en el video (a la pista de audio de la grabación), así se oye
// igual que como queda el archivo.
import { volumenEn, type PlanSonido } from "./sincronia";

/** Canción de fondo de todos los videos (hecha en Suno). */
export const URL_MUSICA = "/audio/palabra-del-dia.mp3";

export interface Sonido {
  voz: AudioBuffer | null;
  musica: AudioBuffer | null;
}

export async function cargarAudio(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${url} (${respuesta.status}).`);
  return ctx.decodeAudioData(await respuesta.arrayBuffer());
}

export interface Reproduccion {
  /** Segundo del video que va sonando ahorita (reloj del audio). */
  segundo: () => number;
  detener: () => void;
}

/**
 * Toca el sonido desde el segundo `desde` del video hacia todas las
 * `salidas`. La música se repite si el video dura más que la canción.
 */
export function tocarSonido(
  ctx: AudioContext,
  sonido: Sonido,
  plan: PlanSonido,
  desde: number,
  salidas: AudioNode[]
): Reproduccion {
  // Un respiro para que todo arranque junto en el mismo instante.
  const t0 = ctx.currentTime + 0.08;
  const enCtx = (segundoVideo: number) => t0 + segundoVideo - desde;
  const fuentes: AudioBufferSourceNode[] = [];
  const nodos: AudioNode[] = [];
  const conectar = (nodo: AudioNode) => {
    salidas.forEach((s) => nodo.connect(s));
    nodos.push(nodo);
  };

  if (sonido.musica && desde < plan.dura) {
    const ganancia = ctx.createGain();
    ganancia.gain.setValueAtTime(volumenEn(plan.musica, desde), t0);
    for (const [t, v] of plan.musica) if (t > desde) ganancia.gain.linearRampToValueAtTime(v, enCtx(t));
    const fuente = ctx.createBufferSource();
    fuente.buffer = sonido.musica;
    fuente.loop = true;
    fuente.connect(ganancia);
    conectar(ganancia);
    fuente.start(t0, desde % sonido.musica.duration);
    fuente.stop(enCtx(plan.dura));
    fuentes.push(fuente);
  }

  if (sonido.voz) {
    for (const tramo of plan.tramos) {
      const largo = tramo.hasta - tramo.desde;
      const fin = tramo.enVideo + largo;
      if (fin <= desde) continue;
      // Si se empieza a media frase, se salta lo que ya pasó.
      const corte = Math.max(desde - tramo.enVideo, 0);
      const fuente = ctx.createBufferSource();
      fuente.buffer = sonido.voz;
      conectar(fuente);
      fuente.start(enCtx(tramo.enVideo + corte), tramo.desde + corte, largo - corte);
      fuentes.push(fuente);
    }
  }

  return {
    segundo: () => desde + ctx.currentTime - t0,
    detener: () => {
      fuentes.forEach((f) => {
        try {
          f.stop();
        } catch {
          // ya había terminado
        }
      });
      nodos.forEach((n) => n.disconnect());
    },
  };
}
