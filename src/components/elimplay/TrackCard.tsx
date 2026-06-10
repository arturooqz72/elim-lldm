"use client";

import { Music, Pause, Play } from "lucide-react";
import { useAudioPlayer } from "./AudioPlayerProvider";
import { cn } from "@/lib/utils";
import type { AudioTrack } from "@/types";

export function TrackCard({ track, queue }: { track: AudioTrack; queue: AudioTrack[] }) {
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
      className="flex flex-col text-left rounded-2xl overflow-hidden transition-all duration-200 group w-full"
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${isCurrent ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,160,23,0.4)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = isCurrent
          ? "rgba(212,160,23,0.4)"
          : "var(--color-border)";
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      {/* Cover */}
      <div
        className="relative aspect-square flex items-center justify-center overflow-hidden"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        {track.cover_url ? (
          <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(212,160,23,0.1)" }}
          >
            <Music size={22} style={{ color: "var(--color-primary)" }} />
          </div>
        )}

        {/* Play overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity",
            isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          style={{ background: "rgba(10,10,18,0.45)" }}
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {isCurrent && isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-0.5">
        <h3
          className="text-sm font-semibold line-clamp-1"
          style={{ color: isCurrent ? "var(--color-primary)" : "var(--color-text)" }}
        >
          {track.title}
        </h3>
        {track.artist && (
          <p className="text-xs line-clamp-1" style={{ color: "var(--color-text-muted)" }}>
            {track.artist}
          </p>
        )}
      </div>
    </button>
  );
}
