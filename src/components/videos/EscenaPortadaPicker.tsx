"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { formatTime } from "@/lib/audio-recording";

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.85;
const CAPTURE_ERROR = "No se pudo capturar la escena, intenta otra vez.";

interface EscenaPortadaPickerProps {
  videoFile: File | null;
  onPick: (file: File, seconds: number) => void;
  disabled?: boolean;
}

export function EscenaPortadaPicker({ videoFile, onPick, disabled }: EscenaPortadaPickerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnsupported(false);
    setError(null);
    setDuration(0);
    setTime(0);
    if (!videoFile) {
      setSrc(null);
      return;
    }
    const objectUrl = URL.createObjectURL(videoFile);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [videoFile]);

  if (!videoFile || !src) return null;

  if (unsupported) {
    return (
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Este formato no se puede previsualizar aquí; puedes subir una imagen como portada.
      </p>
    );
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    const d = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(d);
    // iOS/Safari no pinta el primer fotograma hasta hacer seek.
    video.currentTime = Math.min(0.1, d);
  }

  function handleSlider(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = value;
    setTime(value);
  }

  function capture() {
    const video = videoRef.current;
    setError(null);
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError(CAPTURE_ERROR);
      return;
    }
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError(CAPTURE_ERROR);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const seconds = video.currentTime;
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError(CAPTURE_ERROR);
          return;
        }
        const file = new File([blob], `escena-${Math.floor(seconds)}s.jpg`, { type: "image/jpeg" });
        onPick(file, seconds);
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <video
        ref={videoRef}
        src={src}
        controls
        muted
        playsInline
        preload="metadata"
        className="w-full rounded-xl bg-black max-h-72"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onError={() => setUnsupported(true)}
      />
      {duration > 0 && (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={time}
            disabled={disabled}
            onChange={(e) => handleSlider(Number(e.target.value))}
            className="flex-1 accent-[#D4A017]"
            aria-label="Elegir escena del video"
          />
          <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
            {formatTime(time)} / {formatTime(duration)}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={capture}
        disabled={disabled || duration === 0}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-primary)",
          color: "var(--color-primary)",
        }}
      >
        <Camera size={16} />
        Usar esta escena como portada
      </button>
      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
