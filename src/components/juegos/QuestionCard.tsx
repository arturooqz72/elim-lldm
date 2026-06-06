"use client";

import { useEffect, useState } from "react";
import { BookOpen, Clock } from "lucide-react";

interface QuestionCardProps {
  questionText: string;
  bibleReference?: string | null;
  timeLimit: number;
  endsAt: number; // unix ms timestamp
  questionNumber: number;
  totalQuestions: number;
  points: number;
}

export function QuestionCard({
  questionText,
  bibleReference,
  timeLimit,
  endsAt,
  questionNumber,
  totalQuestions,
  points,
}: QuestionCardProps) {
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  const progress = Math.min(1, timeLeft / timeLimit);
  const isUrgent = timeLeft <= 5;

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full mb-5 overflow-hidden"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-250"
          style={{
            width: `${progress * 100}%`,
            background: isUrgent ? "var(--color-live)" : "var(--color-primary)",
          }}
        />
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between mb-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
        <span>
          Pregunta{" "}
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{questionNumber}</span>
          {" "}de {totalQuestions}
        </span>
        <div className="flex items-center gap-3">
          <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{points} pts</span>
          <div
            className="flex items-center gap-1 font-mono font-bold text-sm"
            style={{ color: isUrgent ? "var(--color-live)" : "var(--color-text)" }}
          >
            <Clock size={13} />
            {timeLeft}s
          </div>
        </div>
      </div>

      {/* Question */}
      <p
        className="text-lg md:text-xl font-semibold leading-relaxed mb-4"
        style={{ color: "var(--color-text)" }}
      >
        {questionText}
      </p>

      {/* Bible reference */}
      {bibleReference && (
        <div
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
          style={{
            background: "rgba(212,160,23,0.08)",
            border: "1px solid rgba(212,160,23,0.15)",
          }}
        >
          <BookOpen size={14} style={{ color: "var(--color-primary)" }} />
          <span style={{ color: "var(--color-primary)" }}>{bibleReference}</span>
        </div>
      )}
    </div>
  );
}
