"use client";

import { Music, Pause, Play } from "lucide-react";
import { useAudioPlayer } from "./AudioPlayerProvider";
import { formatDuration } from "@/lib/utils";
import type { AudioTrack } from "@/types";

export function TrackRow({
  track,
  index,
  queue,
}: {
  track: AudioTrack;
  index: number;
  queue: AudioTrack[];
}) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = useAudioPlayer();
  const isCurrent = currentTrack?.id === track.id;

  function handleClick() {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, queue);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-3 sm:gap-4 w-full px-3 sm:px-4 py-2.5 rounded-xl text-left transition-colors"
      style={{ background: isCurrent ? "rgba(212,160,23,0.08)" : "transparent" }}
      onMouseEnter={(e) => {
        if (!isCurrent) (e.currentTarget as HTMLElement).style.background = "var(--color-surface)";
      }}
      onMouseLeave={(e) => {
        if (!isCurrent) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <div
        className="w-6 text-center shrink-0 text-sm font-mono"
        style={{ color: isCurrent ? "var(--color-primary)" : "var(--color-text-muted)" }}
      >
        {isCurrent ? (
          isPlaying ? (
            <Pause size={14} fill="currentColor" className="inline" />
          ) : (
            <Play size={14} fill="currentColor" className="inline" />
          )
        ) : (
          index
        )}
      </div>

      <div
        className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        {track.cover_url ? (
          <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <Music size={16} style={{ color: "var(--color-primary)" }} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-semibold truncate"
          style={{ color: isCurrent ? "var(--color-primary)" : "var(--color-text)" }}
        >
          {track.title}
        </p>
        {track.artist && (
          <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
            {track.artist}
          </p>
        )}
      </div>

      <span className="hidden sm:block text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>
        {track.play_count.toLocaleString()} reproducciones
      </span>

      {track.duration_seconds != null && (
        <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-text-muted)" }}>
          {formatDuration(track.duration_seconds)}
        </span>
      )}
    </button>
  );
}
