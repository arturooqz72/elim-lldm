"use client";

import { useState } from "react";
import { ChevronDown, Music, Pause, Play, Shuffle } from "lucide-react";
import { useAudioPlayer } from "./AudioPlayerProvider";
import { TrackRow } from "./TrackRow";
import { cn } from "@/lib/utils";
import type { AudioTrack } from "@/types";

export function ArtistAccordion({ name, tracks }: { name: string; tracks: AudioTrack[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const { currentTrack, isPlaying, queue, playTrack, togglePlay, shuffle, toggleShuffle } = useAudioPlayer();

  const isThisQueuePlaying =
    isPlaying &&
    !!currentTrack &&
    tracks.length > 0 &&
    queue.length === tracks.length &&
    queue[0]?.id === tracks[0]?.id;

  function handlePlayAll(e: React.MouseEvent) {
    e.stopPropagation();
    if (tracks.length === 0) return;
    if (isThisQueuePlaying) {
      togglePlay();
    } else {
      playTrack(tracks[0], tracks);
    }
  }

  function handleShuffle(e: React.MouseEvent) {
    e.stopPropagation();
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    if (!shuffle) toggleShuffle();
    playTrack(shuffled[0], shuffled);
  }

  function toggleOpen() {
    setIsOpen((o) => !o);
  }

  function handleHeaderKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleOpen();
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="w-full flex items-center justify-between gap-3 px-4 py-3.5">
        <div
          role="button"
          tabIndex={0}
          onClick={toggleOpen}
          onKeyDown={handleHeaderKeyDown}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        >
          <ChevronDown
            size={16}
            className={cn("transition-transform shrink-0", isOpen && "rotate-180")}
            style={{ color: "var(--color-text-muted)" }}
          />
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(212,160,23,0.1)" }}
          >
            <Music size={16} style={{ color: "var(--color-primary)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
              {name}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {tracks.length} canto{tracks.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleShuffle}
            title="Reproducir aleatoriamente"
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
            style={{
              background: "var(--color-surface-elevated)",
              color: shuffle ? "var(--color-primary)" : "var(--color-text-muted)",
            }}
          >
            <Shuffle size={15} />
          </button>
          <button
            type="button"
            onClick={handlePlayAll}
            title={isThisQueuePlaying ? "Pausar" : "Reproducir todos"}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {isThisQueuePlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-1 px-2 pb-2">
          {tracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i + 1} queue={tracks} />
          ))}
        </div>
      )}
    </div>
  );
}
