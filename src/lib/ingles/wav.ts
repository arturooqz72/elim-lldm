// src/lib/ingles/wav.ts
// WAV PCM 16 bits, mono, 16 kHz: el formato que pide Azure Pronunciation
// Assessment. Funciones puras: el navegador las usa para armar el archivo y
// el servidor para validar lo que recibe (pruebas en Node).

export const WAV_SAMPLE_RATE = 16000;
const ENCABEZADO = 44;

/**
 * Reduce la frecuencia de muestreo (44.1/48 kHz del micrófono → 16 kHz)
 * promediando las muestras de cada intervalo, que sirve de filtro paso-bajas
 * simple y evita el "aliasing" de solo saltarse muestras.
 */
export function reducirMuestreo(entrada: Float32Array, desde: number, hasta = WAV_SAMPLE_RATE): Float32Array {
  if (desde === hasta) return entrada;
  if (desde < hasta) throw new Error(`No se puede subir el muestreo de ${desde} a ${hasta} Hz`);
  const razon = desde / hasta;
  const largo = Math.floor(entrada.length / razon);
  const salida = new Float32Array(largo);
  for (let i = 0; i < largo; i++) {
    const inicio = Math.floor(i * razon);
    const fin = Math.min(Math.floor((i + 1) * razon), entrada.length);
    let suma = 0;
    for (let j = inicio; j < fin; j++) suma += entrada[j];
    salida[i] = fin > inicio ? suma / (fin - inicio) : 0;
  }
  return salida;
}

/** Une los pedazos que entrega el micrófono en un solo arreglo. */
export function unirPedazos(pedazos: Float32Array[]): Float32Array {
  const total = pedazos.reduce((n, p) => n + p.length, 0);
  const salida = new Float32Array(total);
  let pos = 0;
  for (const p of pedazos) {
    salida.set(p, pos);
    pos += p.length;
  }
  return salida;
}

/** Muestras flotantes (-1..1) a 16 kHz → bytes de un WAV PCM 16 bits mono. */
export function codificarWav(muestras: Float32Array, sampleRate = WAV_SAMPLE_RATE): ArrayBuffer {
  const datos = muestras.length * 2;
  const buffer = new ArrayBuffer(ENCABEZADO + datos);
  const v = new DataView(buffer);
  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };
  texto(0, "RIFF");
  v.setUint32(4, 36 + datos, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  v.setUint32(16, 16, true); // tamaño del bloque fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por muestra
  v.setUint16(34, 16, true); // bits por muestra
  texto(36, "data");
  v.setUint32(40, datos, true);
  for (let i = 0; i < muestras.length; i++) {
    const s = Math.max(-1, Math.min(1, muestras[i]));
    v.setInt16(ENCABEZADO + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** Tamaño máximo en bytes de un WAV válido de `segundos` (con margen de 1 s). */
export function bytesMaximos(segundos: number): number {
  return ENCABEZADO + (segundos + 1) * WAV_SAMPLE_RATE * 2;
}

export type WavInfo = { ok: true; segundos: number } | { ok: false; motivo: string };

/**
 * Valida que los bytes sean un WAV PCM 16 bits mono a 16 kHz y calcula su
 * duración real desde el encabezado (no se confía en lo que diga el cliente).
 */
export function leerWav(bytes: ArrayBuffer): WavInfo {
  if (bytes.byteLength < ENCABEZADO) return { ok: false, motivo: "El audio está vacío o incompleto" };
  const v = new DataView(bytes);
  const texto = (pos: number, n: number) =>
    String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(pos + i)));
  if (texto(0, 4) !== "RIFF" || texto(8, 4) !== "WAVE") return { ok: false, motivo: "No es un archivo WAV" };

  // Recorre los bloques: el de formato ("fmt ") y el de datos ("data").
  let pos = 12;
  let formato: { pcm: number; canales: number; rate: number; bits: number } | null = null;
  let datos = -1;
  while (pos + 8 <= bytes.byteLength) {
    const id = texto(pos, 4);
    const tam = v.getUint32(pos + 4, true);
    if (id === "fmt " && pos + 24 <= bytes.byteLength) {
      formato = {
        pcm: v.getUint16(pos + 8, true),
        canales: v.getUint16(pos + 10, true),
        rate: v.getUint32(pos + 12, true),
        bits: v.getUint16(pos + 22, true),
      };
    } else if (id === "data") {
      datos = Math.min(tam, bytes.byteLength - pos - 8);
      break;
    }
    pos += 8 + tam + (tam % 2);
  }

  if (!formato) return { ok: false, motivo: "El WAV no tiene formato" };
  if (formato.pcm !== 1 || formato.canales !== 1 || formato.rate !== WAV_SAMPLE_RATE || formato.bits !== 16) {
    return { ok: false, motivo: "El audio debe ser WAV PCM 16 bits, mono, 16 kHz" };
  }
  if (datos < 0) return { ok: false, motivo: "El WAV no tiene datos de audio" };
  return { ok: true, segundos: datos / (WAV_SAMPLE_RATE * 2) };
}
