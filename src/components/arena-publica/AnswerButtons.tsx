"use client";

import { Check, X, Loader2 } from "lucide-react";
import type { AnswerOption } from "@/types";

interface AnswerButtonsProps {
  opciones: { a: string; b: string; c: string; d: string };
  selected: AnswerOption | null;
  correct: AnswerOption | null;
  disabled: boolean;
  loading: boolean;
  onAnswer: (option: AnswerOption) => void;
}

const LABELS: Record<AnswerOption, string> = { a: "A", b: "B", c: "C", d: "D" };

const COLORS: Record<AnswerOption, string> = {
  a: "#EF4444", // rojo
  b: "#3B82F6", // azul
  c: "#22C55E", // verde
  d: "#EAB308", // amarillo
};

export function AnswerButtons({
  opciones,
  selected,
  correct,
  disabled,
  loading,
  onAnswer,
}: AnswerButtonsProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {(Object.keys(opciones) as AnswerOption[]).map((key) => {
        const color = COLORS[key];
        const isSelected = selected === key;
        const isCorrect = correct === key;
        const isWrongSelection = isSelected && correct !== null && !isCorrect;
        const isRevealing = correct !== null;

        let opacity = 1;
        if (isRevealing && !isCorrect && !isWrongSelection) opacity = 0.4;

        return (
          <button
            key={key}
            onClick={() => !disabled && !selected && onAnswer(key)}
            disabled={disabled || !!selected}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl text-left transition-all duration-200"
            style={{
              background: color,
              color: "#fff",
              opacity,
              border: isCorrect ? "3px solid #fff" : "3px solid transparent",
              cursor: disabled || !!selected ? "default" : "pointer",
              transform: isSelected && !isRevealing ? "scale(1.02)" : "scale(1)",
            }}
          >
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-extrabold shrink-0"
              style={{ background: "rgba(0,0,0,0.2)" }}
            >
              {LABELS[key]}
            </span>
            <span className="flex-1 text-lg font-bold leading-snug">{opciones[key]}</span>
            {loading && isSelected && <Loader2 size={22} className="animate-spin shrink-0" />}
            {isRevealing && isCorrect && <Check size={24} className="shrink-0" />}
            {isRevealing && isWrongSelection && <X size={24} className="shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
