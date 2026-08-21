"use client";

import { useEffect, useRef, useState } from "react";

interface AudioLevelMeterProps {
  track: MediaStreamTrack | null | undefined;
  barCount?: number;
  height?: number;
  activeColor?: string;
}

export function AudioLevelMeter({
  track,
  barCount = 5,
  height = 12,
  activeColor = "var(--color-success)",
}: AudioLevelMeterProps) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!track || track.readyState !== "live" || track.muted) {
      setLevel(0);
      return;
    }

    let audioContext: AudioContext;
    let source: MediaStreamAudioSourceNode;
    let analyser: AnalyserNode;
    let cancelled = false;

    try {
      audioContext = new AudioContext();
      source = audioContext.createMediaStreamSource(new MediaStream([track]));
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
    } catch {
      setLevel(0);
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      if (cancelled) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      setLevel(Math.min(1, avg / 110));
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      void audioContext.close().catch(() => {});
    };
  }, [track]);

  const activeBars = Math.round(level * barCount);

  return (
    <div
      className="flex items-end gap-0.5 shrink-0"
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          style={{
            width: "3px",
            height: `${((i + 1) / barCount) * 100}%`,
            borderRadius: "1px",
            background: i < activeBars ? activeColor : "var(--color-border)",
            transition: "background 80ms linear",
          }}
        />
      ))}
    </div>
  );
}
