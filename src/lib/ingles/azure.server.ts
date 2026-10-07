// src/lib/ingles/azure.server.ts
// Azure Speech — Pronunciation Assessment por la API REST de audio corto.
// Solo servidor: usa AZURE_SPEECH_KEY, que nunca llega al navegador.
// Docs: learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short

import type { PronFonema, PronPalabra } from "@/types";

export interface EvaluacionAzure {
  puntaje: number;
  precision: number;
  fluidez: number;
  completitud: number;
  palabras: PronPalabra[];
}

export type ResultadoAzure =
  | { ok: true; evaluacion: EvaluacionAzure }
  /** sin_voz: no se detectó habla; error: falla del servicio. Ninguno se cobra. */
  | { ok: false; tipo: "sin_voz" | "error"; detalle: string };

// La respuesta REST trae los puntajes "planos" en NBest/Words/Phonemes, pero
// algunas versiones los anidan en PronunciationAssessment: se aceptan ambos.
interface Puntajes {
  AccuracyScore?: number;
  FluencyScore?: number;
  CompletenessScore?: number;
  PronScore?: number;
  ErrorType?: string;
  PronunciationAssessment?: Omit<Puntajes, "PronunciationAssessment">;
}
interface FonemaAzure extends Puntajes {
  Phoneme?: string;
}
interface PalabraAzure extends Puntajes {
  Word?: string;
  Phonemes?: FonemaAzure[];
}
interface NBestAzure extends Puntajes {
  Words?: PalabraAzure[];
}
interface RespuestaAzure {
  RecognitionStatus?: string;
  NBest?: NBestAzure[];
}

function valor(o: Puntajes, campo: Exclude<keyof Puntajes, "PronunciationAssessment" | "ErrorType">): number {
  const n = o[campo] ?? o.PronunciationAssessment?.[campo];
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

export function azureConfigurado(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

export async function evaluarPronunciacion(wav: ArrayBuffer, textoReferencia: string): Promise<ResultadoAzure> {
  const clave = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!clave || !region) return { ok: false, tipo: "error", detalle: "Azure Speech no está configurado" };

  const parametros = {
    ReferenceText: textoReferencia,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: "True",
  };
  const url =
    `https://${encodeURIComponent(region)}.stt.speech.microsoft.com` +
    "/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed";

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": clave,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        Accept: "application/json",
        "Pronunciation-Assessment": Buffer.from(JSON.stringify(parametros), "utf8").toString("base64"),
      },
      body: wav,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return { ok: false, tipo: "error", detalle: `Sin respuesta de Azure: ${err instanceof Error ? err.message : err}` };
  }

  if (!respuesta.ok) {
    return { ok: false, tipo: "error", detalle: `Azure HTTP ${respuesta.status}: ${(await respuesta.text()).slice(0, 300)}` };
  }

  const data = (await respuesta.json().catch(() => null)) as RespuestaAzure | null;
  const estado = data?.RecognitionStatus;
  if (estado === "NoMatch" || estado === "InitialSilenceTimeout" || estado === "BabbleTimeout") {
    return { ok: false, tipo: "sin_voz", detalle: estado };
  }
  const mejor = data?.NBest?.[0];
  if (estado !== "Success" || !mejor) {
    return { ok: false, tipo: "error", detalle: `Respuesta inesperada de Azure: ${estado ?? "sin estado"}` };
  }

  const palabras: PronPalabra[] = (mejor.Words ?? []).map((w) => ({
    palabra: w.Word ?? "",
    puntaje: valor(w, "AccuracyScore"),
    error: w.ErrorType ?? w.PronunciationAssessment?.ErrorType ?? "None",
    fonemas: (w.Phonemes ?? []).map(
      (f): PronFonema => ({ fonema: (f.Phoneme ?? "").toLowerCase(), puntaje: valor(f, "AccuracyScore") }),
    ),
  }));

  // Si no dijo ninguna palabra de la frase, se trata como "no se detectó voz".
  const dichas = palabras.filter((p) => p.error !== "Omission" && p.error !== "Insertion");
  if (dichas.length === 0) return { ok: false, tipo: "sin_voz", detalle: "Ninguna palabra de la frase" };

  return {
    ok: true,
    evaluacion: {
      puntaje: valor(mejor, "PronScore"),
      precision: valor(mejor, "AccuracyScore"),
      fluidez: valor(mejor, "FluencyScore"),
      completitud: valor(mejor, "CompletenessScore"),
      palabras,
    },
  };
}
