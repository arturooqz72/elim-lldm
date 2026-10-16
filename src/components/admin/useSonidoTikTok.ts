// src/components/admin/useSonidoTikTok.ts
//
// Sonido del video de TikTok de un día: la voz guardada en B2 (si ya se
// generó) y la canción de fondo, ya decodificadas para Web Audio. El
// AudioContext nace en pausa (el navegador no deja sonar nada sin un
// clic); `despertar()` lo enciende desde el botón de reproducir o grabar.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PalabraVozTikTok } from "@/types";
import { cargarAudio, URL_MUSICA, type Sonido } from "@/lib/palabra/video/sonido";

const urlVoz = (v: PalabraVozTikTok) =>
  `/api/admin/palabra/tiktok/voz/audio?fecha=${v.fecha}&v=${encodeURIComponent(v.creada)}`;

export interface SonidoTikTok {
  /** undefined = todavía se está revisando si el día tiene voz. */
  voz: PalabraVozTikTok | null | undefined;
  sonido: Sonido;
  /** Hay voz guardada pero su MP3 todavía se está bajando. */
  bajandoVoz: boolean;
  error: string | null;
  contexto: () => AudioContext | null;
  despertar: () => Promise<AudioContext | null>;
  cambiarVoz: (nueva: PalabraVozTikTok) => void;
}

export function useSonidoTikTok(fecha: string): SonidoTikTok {
  const ctx = useRef<AudioContext | null>(null);
  const [voz, setVoz] = useState<PalabraVozTikTok | null | undefined>(undefined);
  const [sonido, setSonido] = useState<Sonido>({ voz: null, musica: null });
  const [error, setError] = useState<string | null>(null);

  const contexto = useCallback(() => {
    if (!ctx.current && typeof AudioContext !== "undefined") ctx.current = new AudioContext();
    return ctx.current;
  }, []);

  const despertar = useCallback(async () => {
    const c = contexto();
    if (c && c.state !== "running") await c.resume().catch(() => undefined);
    return c;
  }, [contexto]);

  useEffect(
    () => () => {
      void ctx.current?.close();
      ctx.current = null;
    },
    []
  );

  // La canción de fondo, una vez.
  useEffect(() => {
    const c = contexto();
    if (!c) return;
    let vivo = true;
    cargarAudio(c, URL_MUSICA)
      .then((musica) => vivo && setSonido((s) => ({ ...s, musica })))
      .catch(() => vivo && setError("No se pudo cargar la canción de fondo."));
    return () => {
      vivo = false;
    };
  }, [contexto]);

  // ¿Este día ya tiene voz?
  useEffect(() => {
    let vivo = true;
    setVoz(undefined);
    setSonido((s) => ({ ...s, voz: null }));
    fetch(`/api/admin/palabra/tiktok/voz?fecha=${fecha}`)
      .then(async (r) => {
        const datos = (await r.json()) as { voz?: PalabraVozTikTok | null; error?: string };
        if (!r.ok) throw new Error(datos.error ?? "No se pudo revisar la voz guardada.");
        if (vivo) setVoz(datos.voz ?? null);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setVoz(null);
        setError(e instanceof Error ? e.message : "No se pudo revisar la voz guardada.");
      });
    return () => {
      vivo = false;
    };
  }, [fecha]);

  // Su MP3, cada vez que cambia (al generar o regenerar).
  useEffect(() => {
    const c = contexto();
    if (!c || !voz) return;
    let vivo = true;
    cargarAudio(c, urlVoz(voz))
      .then((audio) => vivo && setSonido((s) => ({ ...s, voz: audio })))
      .catch(() => vivo && setError("No se pudo cargar el MP3 de la voz."));
    return () => {
      vivo = false;
    };
  }, [voz, contexto]);

  const cambiarVoz = useCallback((nueva: PalabraVozTikTok) => {
    setError(null);
    setSonido((s) => ({ ...s, voz: null }));
    setVoz(nueva);
  }, []);

  return {
    voz,
    sonido,
    bajandoVoz: Boolean(voz) && !sonido.voz,
    error,
    contexto,
    despertar,
    cambiarVoz,
  };
}
