"use client";

import { Pause, Play } from "lucide-react";
import { useAudioPlayer } from "./AudioPlayerProvider";
import type { AudioTrack } from "@/types";

export function PlayAllButton({ tracks }: { tracks: AudioTrack[] }) {
  const { currentTrack, isPlaying, queue, playTrack, togglePlay } = useAudioPlayer();

  const isThisQueuePlaying =
    isPlaying && currentTrack && queue.length === tracks.length && queue[0]?.id === tracks[0]?.id;

  function handleClick() {
    if (tracks.length === 0) return;
    if (isThisQueuePlaying) {
      togglePlay();
    } else {
      playTrack(tracks[0], tracks);
    }
  }

  if (tracks.length === 0) return null;

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all duration-200"
      style={{ background: "var(--color-primary)", color: "#000" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(212,160,23,0.4)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {isThisQueuePlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      {isThisQueuePlaying ? "Pausar" : "Reproducir todo"}
    </button>
  );
}
