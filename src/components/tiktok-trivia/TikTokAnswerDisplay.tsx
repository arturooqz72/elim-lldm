import { Check, Trophy } from "lucide-react";
import type { AnswerOption } from "@/types";

interface TikTokAnswerDisplayProps {
  opciones: { a: string; b: string; c: string; d: string };
  correct: AnswerOption | null;
  winnerAnswer: AnswerOption | null;
}

const LABELS: Record<AnswerOption, string> = { a: "A", b: "B", c: "C", d: "D" };

const COLORS: Record<AnswerOption, string> = {
  a: "#EF4444",
  b: "#3B82F6",
  c: "#22C55E",
  d: "#EAB308",
};

export function TikTokAnswerDisplay({ opciones, correct, winnerAnswer }: TikTokAnswerDisplayProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {(Object.keys(opciones) as AnswerOption[]).map((key) => {
        const color = COLORS[key];
        const isCorrect = correct === key;
        const isRevealing = correct !== null;
        const isWinnerAnswer = winnerAnswer === key;

        return (
          <div
            key={key}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl transition-all duration-200"
            style={{
              background: color,
              color: "#fff",
              opacity: isRevealing && !isCorrect ? 0.4 : 1,
              border: isCorrect ? "3px solid #fff" : "3px solid transparent",
            }}
          >
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-extrabold shrink-0"
              style={{ background: "rgba(0,0,0,0.2)" }}
            >
              {LABELS[key]}
            </span>
            <span className="flex-1 text-lg font-bold leading-snug">{opciones[key]}</span>
            {isWinnerAnswer && <Trophy size={22} className="shrink-0" />}
            {isRevealing && isCorrect && <Check size={24} className="shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}
