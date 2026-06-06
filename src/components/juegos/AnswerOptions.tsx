"use client";

import { CheckCircle, XCircle, Loader2 } from "lucide-react";

type AnswerOption = "a" | "b" | "c" | "d";

interface AnswerOptionsProps {
  options: { a: string; b: string; c: string; d: string };
  selected: AnswerOption | null;
  correct: AnswerOption | null; // revealed after question ends
  disabled: boolean;
  loading: AnswerOption | null;
  onAnswer: (option: AnswerOption) => void;
}

const LABELS: Record<AnswerOption, string> = { a: "A", b: "B", c: "C", d: "D" };

const COLORS: Record<AnswerOption, string> = {
  a: "#60A5FA", // blue
  b: "#A78BFA", // purple
  c: "#FBBF24", // yellow
  d: "#F97316", // orange
};

export function AnswerOptions({
  options,
  selected,
  correct,
  disabled,
  loading,
  onAnswer,
}: AnswerOptionsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(Object.keys(options) as AnswerOption[]).map((key) => {
        const isSelected = selected === key;
        const isCorrect = correct === key;
        const isWrong = isSelected && correct !== null && !isCorrect;
        const isLoading = loading === key;
        const color = COLORS[key];

        let borderColor = "var(--color-border)";
        let bgColor = "var(--color-surface-elevated)";
        let textColor = "var(--color-text)";
        let icon = null;

        if (correct !== null) {
          // Reveal phase
          if (isCorrect) {
            borderColor = "var(--color-success)";
            bgColor = "rgba(74,222,128,0.1)";
            textColor = "var(--color-success)";
            icon = <CheckCircle size={16} style={{ color: "var(--color-success)" }} />;
          } else if (isWrong) {
            borderColor = "var(--color-destructive)";
            bgColor = "rgba(248,113,113,0.1)";
            textColor = "var(--color-destructive)";
            icon = <XCircle size={16} style={{ color: "var(--color-destructive)" }} />;
          }
        } else if (isSelected) {
          borderColor = color;
          bgColor = `${color}22`;
          textColor = color;
        }

        return (
          <button
            key={key}
            onClick={() => !disabled && !selected && onAnswer(key)}
            disabled={disabled || !!selected || !!loading}
            className="flex items-center gap-3 px-4 py-4 rounded-xl text-left transition-all duration-200"
            style={{
              background: bgColor,
              border: `1px solid ${borderColor}`,
              color: textColor,
              cursor: disabled || !!selected ? "default" : "pointer",
              transform: isSelected && !correct ? "scale(1.01)" : "scale(1)",
            }}
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: `${color}22`, color }}
            >
              {LABELS[key]}
            </span>
            <span className="flex-1 text-sm font-medium leading-snug">
              {options[key]}
            </span>
            {isLoading && <Loader2 size={16} className="animate-spin shrink-0" />}
            {icon && !isLoading && icon}
          </button>
        );
      })}
    </div>
  );
}
