"use client";

import { useEffect, useState } from "react";
import { TURN_SECONDS } from "@/lib/ruleta/wheel";

const RETRY_MS = 2000;

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
    let retry: ReturnType<typeof setInterval> | null = null;
    setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onExpire();
        // Si el reloj de este dispositivo va adelantado, el servidor rechaza
        // el aviso porque para él el turno aún no vence, y nadie volvía a
        // avisar: la sala se quedaba trabada. Se reintenta hasta que llegue
        // un deadline nuevo (que desmonta este efecto).
        retry = setInterval(onExpire, RETRY_MS);
      }
    }, 250);

    return () => {
      clearInterval(interval);
      if (retry) clearInterval(retry);
    };
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
