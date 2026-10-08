"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Tipos mínimos de la Web Speech API (no todos los navegadores la traen y
// TypeScript no incluye la versión con prefijo webkit).
interface ResultadoVoz {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface EventoResultadoVoz {
  readonly resultIndex: number;
  readonly results: ArrayLike<ResultadoVoz>;
}
interface EventoErrorVoz {
  readonly error: string;
}
interface ReconocedorVoz {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: EventoResultadoVoz) => void) | null;
  onerror: ((e: EventoErrorVoz) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type ConstructorReconocedor = new () => ReconocedorVoz;

function constructorReconocedor(): ConstructorReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocedor;
    webkitSpeechRecognition?: ConstructorReconocedor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MENSAJES_ERROR: Record<string, string> = {
  "not-allowed": "Permite el micrófono en tu navegador para contestar con voz.",
  "service-not-allowed": "Tu navegador no deja usar el dictado por voz aquí.",
  "no-speech": "No te escuché. Toca el micrófono y vuelve a intentar.",
  "audio-capture": "No se encontró un micrófono.",
  network: "Sin conexión para reconocer la voz. Intenta escribiendo.",
};

/**
 * Dictado por voz en español con la Web Speech API del navegador (gratis, sin
 * servidor). `onTexto` recibe la frase completa dicha hasta el momento, para
 * ir llenando el campo mientras la persona habla.
 */
export function useDictado(onTexto: (texto: string) => void) {
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconocedorRef = useRef<ReconocedorVoz | null>(null);
  const onTextoRef = useRef(onTexto);
  useEffect(() => {
    onTextoRef.current = onTexto;
  }, [onTexto]);

  // Se detecta en el cliente para que el HTML del servidor coincida.
  useEffect(() => {
    setSoportado(constructorReconocedor() !== null);
    return () => reconocedorRef.current?.abort();
  }, []);

  const detener = useCallback(() => reconocedorRef.current?.stop(), []);

  const iniciar = useCallback(() => {
    const Reconocedor = constructorReconocedor();
    if (!Reconocedor || reconocedorRef.current) return;
    const r = new Reconocedor();
    r.lang = "es-MX";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let finales = "";
    r.onresult = (e) => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finales += `${res[0].transcript} `;
        else parcial += res[0].transcript;
      }
      onTextoRef.current(`${finales}${parcial}`.replace(/\s+/g, " ").trim());
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") setError(MENSAJES_ERROR[e.error] ?? "No se pudo usar el micrófono.");
    };
    r.onend = () => {
      reconocedorRef.current = null;
      setEscuchando(false);
    };
    reconocedorRef.current = r;
    setError(null);
    setEscuchando(true);
    try {
      r.start();
    } catch {
      reconocedorRef.current = null;
      setEscuchando(false);
      setError("No se pudo usar el micrófono.");
    }
  }, []);

  return { soportado, escuchando, error, iniciar, detener };
}
