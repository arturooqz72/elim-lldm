"use client";

import { useEffect, useState } from "react";
import { TURN_SECONDS } from "@/lib/ruleta/wheel";

interface TurnTimerProps {
  endsAt: number | null;
  onExpire: () => void;
}

export function TurnTimer({ endsAt, onExpire }: TurnTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() =>
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : TURN_SECONDS
  );

  useEffect(() => {
    if (!endsAt) return;
    setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  if (!endsAt) return null;
  const urgent = timeLeft <= 3;

  return (
    <div
      className="font-mono font-extrabold rounded-lg px-3 py-1.5 text-center"
      style={{
        fontSize: "1.2rem",
        color: urgent ? "var(--color-live)" : "#ffdd66",
        background: "#050505",
        border: `2px solid ${urgent ? "var(--color-live)" : "#A07810"}`,
      }}
    >
      ⏱ {timeLeft}
    </div>
  );
}
