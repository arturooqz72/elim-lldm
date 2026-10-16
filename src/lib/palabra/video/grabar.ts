// src/lib/palabra/video/grabar.ts
//
// Graba el lienzo a un archivo de video con MediaRecorder, sin grabar la
// pantalla: el navegador va pintando cada cuadro y lo guarda. MP4 donde el
// navegador lo permite (Chrome reciente, Safari); si no, WebM. Tarda lo
// mismo que dura el video, y la pestaña tiene que quedar visible: en
// segundo plano el navegador frena el dibujo y el video saldría trabado.

const FORMATOS: ReadonlyArray<readonly [string, "mp4" | "webm"]> = [
  ["video/mp4;codecs=avc1.640028", "mp4"],
  ["video/mp4;codecs=avc1.42E01E", "mp4"],
  ["video/mp4", "mp4"],
  ["video/webm;codecs=vp9", "webm"],
  ["video/webm;codecs=vp8", "webm"],
  ["video/webm", "webm"],
];

export interface Formato {
  tipo: string;
  extension: "mp4" | "webm";
}

/** El mejor formato que este navegador puede grabar; null si no puede grabar video. */
export function formatoDisponible(): Formato | null {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  for (const [tipo, extension] of FORMATOS) {
    if (MediaRecorder.isTypeSupported(tipo)) return { tipo, extension };
  }
  return null;
}

export async function grabarLienzo(
  lienzo: HTMLCanvasElement,
  formato: Formato,
  dura: number,
  dibujar: (t: number) => void,
  alAvanzar: (fraccion: number) => void
): Promise<Blob> {
  const flujo = lienzo.captureStream(30);
  const grabadora = new MediaRecorder(flujo, { mimeType: formato.tipo, videoBitsPerSecond: 10_000_000 });
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
  const inicio = performance.now();
  await new Promise<void>((listo) => {
    const cuadro = () => {
      const t = (performance.now() - inicio) / 1000;
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
  flujo.getTracks().forEach((pista) => pista.stop());
  return new Blob(pedazos, { type: formato.tipo.split(";")[0] });
}
