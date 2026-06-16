"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Radio } from "lucide-react";
import { RADIO_STREAM_URL, fetchNowPlaying } from "@/lib/azuracast/api";
import { RadioVisualizer } from "./RadioVisualizer";

const NOW_PLAYING_POLL_INTERVAL_MS = 20_000;

interface RadioPlayerProps {
  listenerCount?: number;
  nowPlayingTitle?: string;
  nowPlayingArtist?: string;
  albumArt?: string;
}

export function RadioPlayer({
  listenerCount: initialListenerCount,
  nowPlayingTitle: initialNowPlayingTitle,
  nowPlayingArtist: initialNowPlayingArtist,
  albumArt: initialAlbumArt,
}: RadioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isBuffering, setIsBuffering] = useState(false);
  const [listenerCount, setListenerCount] = useState(initialListenerCount);
  const [nowPlayingTitle, setNowPlayingTitle] = useState(initialNowPlayingTitle);
  const [nowPlayingArtist, setNowPlayingArtist] = useState(initialNowPlayingArtist);
  const [albumArt, setAlbumArt] = useState(initialAlbumArt);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;

    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => { setIsBuffering(false); setIsPlaying(true); };
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
    };
  }, [volume]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const data = await fetchNowPlaying();
      if (cancelled || !data) return;

      setListenerCount(data.listeners.current);
      setNowPlayingTitle(data.now_playing.song.title);
      setNowPlayingArtist(data.now_playing.song.artist);
      setAlbumArt(data.now_playing.song.art);
    }

    const interval = setInterval(poll, NOW_PLAYING_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      // Clear src to stop buffering
      audio.src = "";
    } else {
      audio.src = RADIO_STREAM_URL;
      setIsBuffering(true);
      audio.play().catch(console.error);
    }
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
      const shouldMute = v === 0;
      audioRef.current.muted = shouldMute;
      setIsMuted(shouldMute);
    }
  }

  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <audio ref={audioRef} preload="none" />

      {/* Album art banner */}
      <div
        className="relative h-48 flex items-center justify-center overflow-hidden"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        {albumArt ? (
          <>
            {/* Blurred background */}
            <div
              className="absolute inset-0 scale-110"
              style={{
                backgroundImage: `url(${albumArt})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(20px)",
                opacity: 0.4,
              }}
            />
            <img
              src={albumArt}
              alt="Album art"
              className="relative w-32 h-32 rounded-2xl object-cover shadow-2xl"
              style={{ border: "1px solid rgba(212,160,23,0.2)" }}
            />
          </>
        ) : (
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.2)" }}
          >
            <Radio size={36} style={{ color: "var(--color-primary)" }} />
          </div>
        )}

        {/* Live badge */}
        <div className="absolute top-3 left-3">
          <span
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: "var(--color-live)", color: "#fff" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"
            />
            EN VIVO
          </span>
        </div>

        {listenerCount !== undefined && (
          <div className="absolute top-3 right-3">
            <span
              className="px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
              style={{
                background: "rgba(10,10,18,0.6)",
                color: "var(--color-text-muted)",
              }}
            >
              {listenerCount} oyentes
            </span>
          </div>
        )}
      </div>

      {/* Info + controls */}
      <div className="p-5 flex flex-col gap-4">
        {/* Song info */}
        <div className="min-w-0">
          <p className="font-semibold text-base truncate" style={{ color: "var(--color-text)" }}>
            {nowPlayingTitle || "Elim LLDM Radio"}
          </p>
          {nowPlayingArtist && (
            <p className="text-sm truncate" style={{ color: "var(--color-text-muted)" }}>
              {nowPlayingArtist}
            </p>
          )}
        </div>

        {/* Visualizer */}
        <RadioVisualizer isPlaying={isPlaying} />

        {/* Controls row */}
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
            style={{
              background: "var(--color-primary)",
              color: "#000",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(212,160,23,0.5)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            {isBuffering ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={toggleMute}
              className="shrink-0"
              style={{ color: "var(--color-text-muted)" }}
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={effectiveVolume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--color-primary) ${effectiveVolume * 100}%, var(--color-border) ${effectiveVolume * 100}%)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
