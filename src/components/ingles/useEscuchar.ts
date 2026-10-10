"use client";

import { useCallback, useEffect, useState } from "react";

/** Voz en inglés del teléfono o la computadora (la de Estados Unidos si hay). */
function vozIngles(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis.getVoices();
  return (
    voces.find((v) => v.lang.replace("_", "-") === "en-US") ??
    voces.find((v) => v.lang.replace("_", "-").startsWith("en"))
  );
}

/** Lee un texto en inglés con la voz del navegador (gratis, sin servidor). */
export function escuchar(texto: string, alTerminar?: () => void): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const voz = new SpeechSynthesisUtterance(texto);
  voz.lang = "en-US";
  voz.rate = 0.85;
  const ingles = vozIngles();
  if (ingles) voz.voice = ingles;
  if (alTerminar) {
    voz.onend = alTerminar;
    voz.onerror = alTerminar;
  }
  window.speechSynthesis.speak(voz);
  return true;
}

/**
 * "🔊 Escuchar" de las tarjetas: dice si el navegador puede leer en voz alta
 * y si está leyendo en este momento (para mostrar el botón activo).
 */
export function useEscuchar() {
  const [disponible, setDisponible] = useState(true);
  const [hablando, setHablando] = useState(false);

  useEffect(() => {
    setDisponible(typeof window !== "undefined" && "speechSynthesis" in window);
    // En Chrome las voces llegan después de cargar la página.
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
  }, []);

  const leer = useCallback((texto: string) => {
    setHablando(true);
    if (!escuchar(texto, () => setHablando(false))) setHablando(false);
  }, []);

  return { disponible, hablando, leer };
}
