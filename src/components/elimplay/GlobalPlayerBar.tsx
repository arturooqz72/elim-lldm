"use client";

import { useEffect } from "react";
import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
} from "lucide-react";
import { useAudioPlayer } from "./AudioPlayerProvider";
import { formatDuration } from "@/lib/utils";

export function GlobalPlayerBar() {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    shuffle,
    repeat,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  } = useAudioPlayer();

  useEffect(() => {
    document.body.classList.toggle("has-player", !!currentTrack);
    return () => {
      document.body.classList.remove("has-player");
    };
  }, [currentTrack]);

  if (!currentTrack) return null;

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-3 sm:px-4 py-2 sm:py-3"
      style={{
        background: "rgba(18,18,30,0.95)",
        borderTop: "1px solid var(--color-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3 sm:gap-4">
        {/* Track info */}
        <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none sm:w-64">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
            style={{ background: "var(--color-surface-elevated)" }}
          >
            {currentTrack.cover_url ? (
              <img
                src={currentTrack.cover_url}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music size={18} style={{ color: "var(--color-primary)" }} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
              {currentTrack.title}
            </p>
            {currentTrack.artists?.name && (
              <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                {currentTrack.artists.name}
              </p>
            )}
          </div>
        </div>

        {/* Controls + progress */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={toggleShuffle}
              className="hidden sm:flex p-1.5 rounded-lg transition-colors"
              style={{ color: shuffle ? "var(--color-primary)" : "var(--color-text-muted)" }}
              title="Aleatorio"
            >
              <Shuffle size={15} />
            </button>
            <button
              onClick={prev}
              className="p-1.5 rounded-lg"
              style={{ color: "var(--color-text)" }}
              title="Anterior"
            >
              <SkipBack size={17} fill="currentColor" />
            </button>
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
              style={{ background: "var(--color-primary)", color: "#000" }}
              title={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            <button
              onClick={next}
              className="p-1.5 rounded-lg"
              style={{ color: "var(--color-text)" }}
              title="Siguiente"
            >
              <SkipForward size={17} fill="currentColor" />
            </button>
            <button
              onClick={cycleRepeat}
              className="hidden sm:flex p-1.5 rounded-lg transition-colors"
              style={{ color: repeat !== "off" ? "var(--color-primary)" : "var(--color-text-muted)" }}
              title="Repetir"
            >
              {repeat === "one" ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </button>
          </div>

          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2 w-full max-w-md">
            <span className="text-xs font-mono w-9 text-right" style={{ color: "var(--color-text-muted)" }}>
              {formatDuration(Math.floor(progress))}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={progress}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--color-primary) ${progressPct}%, var(--color-border) ${progressPct}%)`,
              }}
            />
            <span className="text-xs font-mono w-9" style={{ color: "var(--color-text-muted)" }}>
              {formatDuration(Math.floor(duration))}
            </span>
          </div>
        </div>

        {/* Volume */}
        <div className="hidden md:flex items-center gap-2 w-32 shrink-0">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            style={{ color: "var(--color-text-muted)" }}
          >
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--color-primary) ${volume * 100}%, var(--color-border) ${volume * 100}%)`,
            }}
          />
        </div>
      </div>

      {/* Mobile progress bar */}
      <div className="sm:hidden mt-2">
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={progress}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--color-primary) ${progressPct}%, var(--color-border) ${progressPct}%)`,
          }}
        />
      </div>
    </div>
  );
}
