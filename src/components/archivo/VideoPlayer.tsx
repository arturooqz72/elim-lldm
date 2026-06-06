"use client";

import { useState, useRef } from "react";
import { Play } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  thumbnail?: string | null;
  title: string;
}

export function VideoPlayer({ src, thumbnail, title }: VideoPlayerProps) {
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function handleStart() {
    setStarted(true);
    // Small delay to let browser paint the video element before playing
    setTimeout(() => {
      videoRef.current?.play().catch(console.error);
    }, 50);
  }

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        aspectRatio: "16/9",
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border)",
      }}
    >
      {!started ? (
        /* Poster / play overlay */
        <div className="absolute inset-0 flex items-center justify-center">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-elevated) 100%)",
              }}
            />
          )}
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(10,10,18,0.45)" }}
          />
          <button
            onClick={handleStart}
            className="relative z-10 flex items-center justify-center w-20 h-20 rounded-full transition-all duration-200"
            style={{ background: "var(--color-primary)", color: "#000" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(212,160,23,0.5)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <Play size={30} fill="currentColor" />
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          className="absolute inset-0 w-full h-full object-contain"
          style={{ background: "#000" }}
        >
          Tu navegador no soporta reproducción de video.
        </video>
      )}
    </div>
  );
}
