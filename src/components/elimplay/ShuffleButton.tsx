"use client";

import { Shuffle } from "lucide-react";
import { useAudioPlayer } from "./AudioPlayerProvider";
import { cn } from "@/lib/utils";
import type { AudioTrack } from "@/types";

export function ShuffleButton({
  tracks,
  size = 15,
  className,
}: {
  tracks: AudioTrack[];
  size?: number;
  className?: string;
}) {
  const { shuffle, toggleShuffle, playTrack } = useAudioPlayer();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    if (!shuffle) toggleShuffle();
    playTrack(shuffled[0], shuffled);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Reproducir aleatoriamente"
      className={cn("flex items-center justify-center rounded-full transition-colors shrink-0", className ?? "w-9 h-9")}
      style={{
        background: "var(--color-surface-elevated)",
        color: shuffle ? "var(--color-primary)" : "var(--color-text-muted)",
      }}
    >
      <Shuffle size={size} />
    </button>
  );
}
