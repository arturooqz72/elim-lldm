"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { codificarWav, reducirMuestreo, unirPedazos, WAV_SAMPLE_RATE } from "@/lib/ingles/wav";

export type EstadoGrabadora = "inactiva" | "pidiendo" | "grabando" | "procesando";
export type ErrorGrabadora = "denegado" | "sin_microfono" | "no_soportado" | "otro";

interface Sesion {
  ctx: AudioContext;
  stream: MediaStream;
  nodos: AudioNode[];
  pedazos: Float32Array[];
  /** Pide al worklet el último bloque incompleto (no-op con ScriptProcessor). */
  vaciar: () => Promise<void>;
}

type AudioContextConstructor = typeof AudioContext;

function clasificar(err: unknown): ErrorGrabadora {
  const nombre = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (nombre === "NotAllowedError" || nombre === "SecurityError" || nombre === "PermissionDeniedError") return "denegado";
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError" || nombre === "NotReadableError") return "sin_microfono";
  return "otro";
}

/**
 * Graba del micrófono y entrega un WAV PCM 16 bits mono a 16 kHz.
 * El permiso del micrófono se pide solo al llamar a iniciar() (en el clic).
 * Se detiene sola al llegar a maxSegundos.
 */
export function useGrabadoraWav(maxSegundos: number, onGrabado: (wav: Blob) => void) {
  const [estado, setEstado] = useState<EstadoGrabadora>("inactiva");
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState<ErrorGrabadora | null>(null);
  const sesionRef = useRef<Sesion | null>(null);
  const relojRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onGrabadoRef = useRef(onGrabado);
  useEffect(() => {
    onGrabadoRef.current = onGrabado;
  }, [onGrabado]);

  const limpiar = useCallback(async (s: Sesion) => {
    if (relojRef.current) clearInterval(relojRef.current);
    relojRef.current = null;
    s.nodos.forEach((n) => n.disconnect());
    s.stream.getTracks().forEach((t) => t.stop());
    await s.ctx.close().catch(() => undefined);
  }, []);

  const detener = useCallback(async () => {
    const s = sesionRef.current;
    if (!s) return;
    sesionRef.current = null;
    setEstado("procesando");
    await s.vaciar();
    const rate = s.ctx.sampleRate;
    await limpiar(s);

    const crudo = unirPedazos(s.pedazos);
    const muestras = reducirMuestreo(crudo, rate).subarray(0, maxSegundos * WAV_SAMPLE_RATE);
    onGrabadoRef.current(new Blob([codificarWav(muestras)], { type: "audio/wav" }));
    setEstado("inactiva");
  }, [limpiar, maxSegundos]);

  const iniciar = useCallback(async () => {
    if (sesionRef.current) return;
    setError(null);

    const Ctx: AudioContextConstructor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !Ctx) {
      setError("no_soportado");
      return;
    }

    // El AudioContext se crea dentro del clic: Safari en iPhone lo exige.
    const ctx = new Ctx();
    setEstado("pidiendo");
    let stream: MediaStream;
    try {
      await ctx.resume();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      await ctx.close().catch(() => undefined);
      setError(clasificar(err));
      setEstado("inactiva");
      return;
    }

    try {
      const fuente = ctx.createMediaStreamSource(stream);
      // Salida en silencio: algunos navegadores solo procesan nodos conectados al destino.
      const silencio = ctx.createGain();
      silencio.gain.value = 0;
      silencio.connect(ctx.destination);
      const pedazos: Float32Array[] = [];
      let sesion: Sesion;

      if (ctx.audioWorklet && typeof AudioWorkletNode !== "undefined") {
        await ctx.audioWorklet.addModule("/ingles/grabadora-worklet.js");
        const nodo = new AudioWorkletNode(ctx, "grabadora-pcm");
        nodo.port.onmessage = (e: MessageEvent<Float32Array | string>) => {
          if (e.data instanceof Float32Array) pedazos.push(e.data);
        };
        fuente.connect(nodo);
        nodo.connect(silencio);
        sesion = {
          ctx,
          stream,
          nodos: [fuente, nodo, silencio],
          pedazos,
          vaciar: () =>
            new Promise<void>((resolve) => {
              const listo = setTimeout(resolve, 300);
              nodo.port.addEventListener("message", (e: MessageEvent) => {
                if (e.data === "vaciado") {
                  clearTimeout(listo);
                  resolve();
                }
              });
              nodo.port.postMessage("vaciar");
            }),
        };
      } else {
        // Respaldo para navegadores sin AudioWorklet.
        const nodo = ctx.createScriptProcessor(4096, 1, 1);
        nodo.onaudioprocess = (e) => pedazos.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        fuente.connect(nodo);
        nodo.connect(silencio);
        sesion = { ctx, stream, nodos: [fuente, nodo, silencio], pedazos, vaciar: async () => undefined };
      }

      sesionRef.current = sesion;
      setSegundos(0);
      setEstado("grabando");
      const inicio = Date.now();
      relojRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - inicio) / 1000);
        setSegundos(s);
        if (s >= maxSegundos) void detener();
      }, 250);
    } catch (err) {
      console.error("Elim English — no se pudo iniciar la grabación:", err);
      stream.getTracks().forEach((t) => t.stop());
      await ctx.close().catch(() => undefined);
      setError("otro");
      setEstado("inactiva");
    }
  }, [detener, maxSegundos]);

  // Si el componente se desmonta grabando, se suelta el micrófono.
  useEffect(
    () => () => {
      const s = sesionRef.current;
      sesionRef.current = null;
      if (s) void limpiar(s);
    },
    [limpiar],
  );

  return { estado, segundos, error, iniciar, detener };
}
