// src/lib/palabra/video/grabar.ts
//
// Graba el lienzo a un archivo de video con MediaRecorder, sin grabar la
// pantalla: el navegador va pintando cada cuadro y lo guarda, junto con la
// pista de audio (voz + música) que le pasen. MP4 donde el navegador lo
// permite (Chrome reciente, Safari); si no, WebM. Tarda lo mismo que dura
// el video, y la pestaña tiene que quedar visible: en segundo plano el
// navegador frena el dibujo y el video saldría trabado.

// Con audio primero; los de solo video quedan de respaldo para un
// navegador que no pueda grabar sonido.
const FORMATOS: ReadonlyArray<readonly [string, "mp4" | "webm", boolean]> = [
  ["video/mp4;codecs=avc1.640028,mp4a.40.2", "mp4", true],
  ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4", true],
  ["video/mp4;codecs=avc1.640028,opus", "mp4", true],
  ["video/webm;codecs=vp9,opus", "webm", true],
  ["video/webm;codecs=vp8,opus", "webm", true],
  ["video/mp4;codecs=avc1.640028", "mp4", false],
  ["video/mp4;codecs=avc1.42E01E", "mp4", false],
  ["video/mp4", "mp4", true],
  ["video/webm", "webm", true],
];

export interface Formato {
  tipo: string;
  extension: "mp4" | "webm";
  conAudio: boolean;
}

/** El mejor formato que este navegador puede grabar; null si no puede grabar video. */
export function formatoDisponible(): Formato | null {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  for (const [tipo, extension, conAudio] of FORMATOS) {
    if (MediaRecorder.isTypeSupported(tipo)) return { tipo, extension, conAudio };
  }
  return null;
}

export interface AudioDeGrabacion {
  pistas: MediaStreamTrack[];
  /** Arranca el sonido y devuelve su reloj (segundo del video que va sonando). */
  empezar: () => () => number;
}

export async function grabarLienzo(
  lienzo: HTMLCanvasElement,
  formato: Formato,
  dura: number,
  dibujar: (t: number) => void,
  alAvanzar: (fraccion: number) => void,
  audio?: AudioDeGrabacion
): Promise<Blob> {
  const flujo = lienzo.captureStream(30);
  if (audio && formato.conAudio) audio.pistas.forEach((p) => flujo.addTrack(p));
  const grabadora = new MediaRecorder(flujo, {
    mimeType: formato.tipo,
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 192_000,
  });
  const pedazos: Blob[] = [];
  grabadora.ondataavailable = (e) => {
    if (e.data.size > 0) pedazos.push(e.data);
  };
  const terminado = new Promise<void>((resolver, rechazar) => {
    grabadora.onstop = () => resolver();
    grabadora.onerror = () => rechazar(new Error("El navegador no pudo grabar el video."));
  });

  dibujar(0);
  grabadora.start(250);
  // El dibujo sigue al reloj del audio: así la voz y las escenas no se desfasan.
  const inicio = performance.now();
  const reloj = audio?.empezar() ?? (() => (performance.now() - inicio) / 1000);
  await new Promise<void>((listo) => {
    const cuadro = () => {
      const t = Math.max(reloj(), 0);
      // Medio segundo extra con el último cuadro, para que no se corte el final.
      dibujar(Math.min(t, dura - 0.001));
      alAvanzar(Math.min(t / (dura + 0.5), 1));
      if (t < dura + 0.5) requestAnimationFrame(cuadro);
      else listo();
    };
    requestAnimationFrame(cuadro);
  });
  grabadora.stop();
  await terminado;
  flujo.getVideoTracks().forEach((pista) => pista.stop());
  return new Blob(pedazos, { type: formato.tipo.split(";")[0] });
}
