"use client";

import { useEffect, useState } from "react";

interface CountdownCircleProps {
  endsAt: number;
  totalSeconds: number;
  onExpire?: () => void;
}

const SIZE = 140;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CountdownCircle({ endsAt, totalSeconds, onExpire }: CountdownCircleProps) {
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  );

  useEffect(() => {
    setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  const progress = Math.max(0, Math.min(1, timeLeft / totalSeconds));
  const offset = CIRCUMFERENCE * (1 - progress);
  const isUrgent = timeLeft <= 5;
  const color = isUrgent ? "var(--color-live)" : "var(--color-primary)";

  return (
    <div className="flex items-center justify-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          style={{ stroke: "var(--color-surface-elevated)" }}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ stroke: color, transition: "stroke-dashoffset 0.25s linear, stroke 0.3s" }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize="42"
          fontWeight="800"
          style={{ fill: color }}
        >
          {timeLeft}
        </text>
      </svg>
    </div>
  );
}
