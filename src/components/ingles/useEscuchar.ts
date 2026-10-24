"use client";

import { useCallback, useEffect, useState } from "react";

// La tutora es mujer (así sale en los anuncios de radio): se busca una voz
// femenina por su nombre, porque el navegador no dice si es de hombre o de
// mujer. En Windows la primera en inglés suele ser "Microsoft David".
const FEMENINA =
  /female|samantha|aria|jenny|zira|ava\b|allison|susan|victoria|karen|moira|tessa|fiona|serena|michelle|emma|libby|sonia|natasha|salli|joanna|kendra|kimberly|ivy|google us english|google uk english female|x-sfg|x-iob|x-iog|x-tpc|x-tpf/i;
const MASCULINA =
  /\bmale|david|mark|guy|alex\b|daniel|fred|tom\b|aaron|arthur|christopher|eric|roger|ryan|steffan|matthew|joey|justin|google uk english male|x-iom|x-tpd/i;

/** Voz en inglés del teléfono o la computadora: de mujer y de Estados Unidos si hay. */
function vozIngles(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis.getVoices();
  const esUS = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-") === "en-US";
  const esIngles = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").startsWith("en");
  const esMujer = (v: SpeechSynthesisVoice) => FEMENINA.test(v.name);
  const noEsHombre = (v: SpeechSynthesisVoice) => FEMENINA.test(v.name) || !MASCULINA.test(v.name);
  return (
    voces.find((v) => esUS(v) && esMujer(v)) ??
    voces.find((v) => esIngles(v) && esMujer(v)) ??
    voces.find((v) => esUS(v) && noEsHombre(v)) ??
    voces.find((v) => esIngles(v) && noEsHombre(v)) ??
    voces.find(esUS) ??
    voces.find(esIngles)
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
