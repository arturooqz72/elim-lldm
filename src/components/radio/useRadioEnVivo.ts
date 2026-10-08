"use client";

// Reproducción de la radio en vivo para /escuchar (la app Radio Elim):
// - un <audio> con el mismo stream que la página de Radio;
// - sigue sonando con la pantalla apagada o en otra app (el sistema deja
//   correr el audio de la página) y muestra los controles en la pantalla de
//   bloqueo con la Media Session API;
// - si la señal se corta (cambio de wifi a datos, túnel, etc.) se reconecta
//   sola mientras la persona no haya puesto pausa.

import { useCallback, useEffect, useRef, useState } from "react";
import { RADIO_STREAM_URL, fetchNowPlaying } from "@/lib/azuracast/api";
import { useAudioPlayer } from "@/components/elimplay/AudioPlayerProvider";

const CONSULTA_MS = 20_000;
const REINTENTO_MS = 3_000;
const TITULO_BLOQUEO = "Radio Elim · En vivo";
const LOGO = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
];

export interface AhoraSuena {
  titulo?: string;
  artista?: string;
  locutor?: string;
  oyentes?: number;
}

export type EstadoRadio = "detenida" | "cargando" | "sonando";

export function useRadioEnVivo(inicial: AhoraSuena) {
  const audioRef = useRef<HTMLAudioElement>(null);
  /** La persona quiere oírla (tocó reproducir y no ha puesto pausa). */
  const quiereOir = useRef(false);
  const reintento = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [estado, setEstado] = useState<EstadoRadio>("detenida");
  const [volumen, setVolumenEstado] = useState(0.8);
  const [silencio, setSilencio] = useState(false);
  const [ahora, setAhora] = useState<AhoraSuena>(inicial);
  const elimPlay = useAudioPlayer();
  const elimPlayRef = useRef(elimPlay);
  elimPlayRef.current = elimPlay;

  const conectar = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setEstado("cargando");
    audio.src = RADIO_STREAM_URL;
    audio.play().catch(() => {
      // El navegador no dejó reproducir (por ejemplo, sin un toque previo).
      quiereOir.current = false;
      setEstado("detenida");
    });
  }, []);

  const reproducir = useCallback(() => {
    if (reintento.current) clearTimeout(reintento.current);
    quiereOir.current = true;
    // Si ElimPlay está sonando, se pausa para que no suenen los dos.
    if (elimPlayRef.current.isPlaying) elimPlayRef.current.togglePlay();
    conectar();
  }, [conectar]);

  const pausar = useCallback(() => {
    if (reintento.current) clearTimeout(reintento.current);
    quiereOir.current = false;
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    // En vivo no tiene caso seguir bajando audio en pausa: al volver a
    // reproducir se conecta de nuevo y suena lo de ese momento.
    audio.removeAttribute("src");
    audio.load();
    setEstado("detenida");
  }, []);

  const alternar = useCallback(() => {
    if (quiereOir.current) pausar();
    else reproducir();
  }, [pausar, reproducir]);

  // Eventos del <audio> y reconexión.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.8;

    const reconectar = () => {
      if (!quiereOir.current) return;
      setEstado("cargando");
      if (reintento.current) clearTimeout(reintento.current);
      reintento.current = setTimeout(() => {
        if (quiereOir.current) conectar();
      }, REINTENTO_MS);
    };
    const sonando = () => setEstado("sonando");
    const esperando = () => quiereOir.current && setEstado("cargando");
    // Pausa desde fuera (otra app tomó el audio, audífonos desconectados).
    const pausado = () => {
      if (!audio.getAttribute("src")) return;
      quiereOir.current = false;
      setEstado("detenida");
    };
    const conexionVolvio = () => quiereOir.current && audio.paused && conectar();

    audio.addEventListener("playing", sonando);
    audio.addEventListener("waiting", esperando);
    audio.addEventListener("pause", pausado);
    audio.addEventListener("error", reconectar);
    audio.addEventListener("ended", reconectar);
    window.addEventListener("online", conexionVolvio);
    return () => {
      audio.removeEventListener("playing", sonando);
      audio.removeEventListener("waiting", esperando);
      audio.removeEventListener("pause", pausado);
      audio.removeEventListener("error", reconectar);
      audio.removeEventListener("ended", reconectar);
      window.removeEventListener("online", conexionVolvio);
      if (reintento.current) clearTimeout(reintento.current);
    };
  }, [conectar]);

  // Al salir de la página, deja de sonar (el <audio> se desmonta).
  useEffect(() => () => {
    quiereOir.current = false;
    audioRef.current?.pause();
  }, []);

  // Lo que suena ahora, cada 20 segundos.
  useEffect(() => {
    let cancelado = false;
    const consultar = async () => {
      const datos = await fetchNowPlaying();
      if (cancelado || !datos) return;
      setAhora({
        titulo: datos.now_playing.song.title || undefined,
        artista: datos.now_playing.song.artist || undefined,
        locutor: datos.live.is_live ? datos.live.streamer_name || undefined : undefined,
        oyentes: datos.listeners.current,
      });
    };
    const intervalo = setInterval(consultar, CONSULTA_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  // Controles de la pantalla de bloqueo y del centro de control.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const acciones: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ["play", reproducir],
      ["pause", pausar],
      ["stop", pausar],
      // En vivo no se puede adelantar ni regresar.
      ["seekbackward", null],
      ["seekforward", null],
      ["seekto", null],
      ["previoustrack", null],
      ["nexttrack", null],
    ];
    for (const [accion, fn] of acciones) {
      try {
        ms.setActionHandler(accion, fn);
      } catch {
        // acción no soportada en este navegador
      }
    }
    return () => {
      for (const [accion] of acciones) {
        try {
          ms.setActionHandler(accion, null);
        } catch {
          // igual que arriba
        }
      }
    };
  }, [reproducir, pausar]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    // AzuraCast a veces trae espacios dobles; la pantalla de bloqueo los mostraría.
    const cancion = [ahora.titulo, ahora.artista]
      .filter(Boolean)
      .map((t) => t!.replace(/\s+/g, " ").trim())
      .join(" — ");
    navigator.mediaSession.metadata = new MediaMetadata({
      title: TITULO_BLOQUEO,
      artist: ahora.locutor ? `${ahora.locutor} en vivo` : cancion || "Elim LLDM Radio",
      album: "Elim LLDM",
      artwork: LOGO,
    });
  }, [ahora.titulo, ahora.artista, ahora.locutor]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = estado === "detenida" ? "paused" : "playing";
  }, [estado]);

  function cambiarVolumen(v: number) {
    setVolumenEstado(v);
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = v;
    audio.muted = v === 0;
    setSilencio(v === 0);
  }

  function alternarSilencio() {
    const audio = audioRef.current;
    if (!audio) return;
    const nuevo = !silencio;
    audio.muted = nuevo;
    setSilencio(nuevo);
    // Quitar el silencio con el volumen en 0 no sonaría: se sube un poco.
    if (!nuevo && volumen === 0) cambiarVolumen(0.5);
  }

  return { audioRef, estado, alternar, volumen, silencio, cambiarVolumen, alternarSilencio, ahora };
}
