"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { AudioTrack } from "@/types";

type RepeatMode = "off" | "all" | "one";

interface AudioPlayerContextValue {
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playTrack: (track: AudioTrack, queue?: AudioTrack[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const countedRef = useRef<Set<string>>(new Set());

  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");

  const playIndex = useCallback((list: AudioTrack[], index: number) => {
    const track = list[index];
    if (!track) return;
    setCurrentIndex(index);
    setCurrentTrack(track);
    setIsPlaying(true);
  }, []);

  const playTrack = useCallback(
    (track: AudioTrack, newQueue?: AudioTrack[]) => {
      const list = newQueue && newQueue.length > 0 ? newQueue : [track];
      const index = list.findIndex((t) => t.id === track.id);
      setQueue(list);
      playIndex(list, index >= 0 ? index : 0);
    },
    [playIndex]
  );

  const next = useCallback(() => {
    if (queue.length === 0) return;
    if (shuffle) {
      let randomIndex = Math.floor(Math.random() * queue.length);
      if (queue.length > 1) {
        while (randomIndex === currentIndex) {
          randomIndex = Math.floor(Math.random() * queue.length);
        }
      }
      playIndex(queue, randomIndex);
      return;
    }
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      playIndex(queue, nextIndex);
    } else if (repeat === "all") {
      playIndex(queue, 0);
    } else {
      setIsPlaying(false);
    }
  }, [queue, currentIndex, shuffle, repeat, playIndex]);

  const prev = useCallback(() => {
    if (queue.length === 0) return;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      return;
    }
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      playIndex(queue, prevIndex);
    } else if (repeat === "all") {
      playIndex(queue, queue.length - 1);
    }
  }, [queue, currentIndex, repeat, playIndex]);

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    setIsPlaying((p) => !p);
  }, [currentTrack]);

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
    }
    setProgress(seconds);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
  }, []);

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }, []);

  // Keep <audio> volume in sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Load new track / play-pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (!audio.src.endsWith(currentTrack.audio_url)) {
      audio.src = currentTrack.audio_url;
      audio.load();
      setProgress(0);
      setDuration(0);
    }

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying]);

  // Audio element event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onPlay = () => {
      setIsPlaying(true);
      if (currentTrack && !countedRef.current.has(currentTrack.id)) {
        countedRef.current.add(currentTrack.id);
        const supabase = createClient();
        void supabase.rpc("increment_audio_play_count", { track_id: currentTrack.id });
      }
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      if (repeat === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        next();
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentTrack, repeat, next]);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        queue,
        currentIndex,
        isPlaying,
        progress,
        duration,
        volume,
        shuffle,
        repeat,
        playTrack,
        togglePlay,
        next,
        prev,
        seek,
        setVolume,
        toggleShuffle,
        cycleRepeat,
      }}
    >
      {children}
      <audio ref={audioRef} preload="metadata" />
    </AudioPlayerContext.Provider>
  );
}
