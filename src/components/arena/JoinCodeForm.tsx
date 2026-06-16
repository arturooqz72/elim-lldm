"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

interface JoinCodeFormProps {
  notFound?: boolean;
}

export function JoinCodeForm({ notFound }: JoinCodeFormProps) {
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 4) return;
    startTransition(() => {
      router.push(`/arena/${code}`);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={code}
          onChange={handleChange}
          placeholder="ELIM"
          maxLength={4}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 rounded-xl px-4 py-4 text-2xl font-mono font-bold uppercase text-center outline-none transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: `1px solid ${notFound ? "var(--color-destructive)" : "var(--color-border)"}`,
            color: "var(--color-text)",
            letterSpacing: "0.3em",
          }}
          onFocus={(e) => {
            if (!notFound) e.currentTarget.style.borderColor = "var(--color-primary)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = notFound
              ? "var(--color-destructive)"
              : "var(--color-border)";
          }}
        />
        <button
          type="submit"
          disabled={code.length !== 4 || isPending}
          className="flex items-center justify-center gap-2 px-5 rounded-xl text-base font-semibold transition-all duration-200"
          style={{
            background:
              code.length === 4 && !isPending
                ? "var(--color-primary)"
                : "var(--color-surface-elevated)",
            color: code.length === 4 && !isPending ? "#000" : "var(--color-text-muted)",
            cursor: code.length === 4 && !isPending ? "pointer" : "not-allowed",
          }}
        >
          {isPending ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        </button>
      </form>

      {notFound && (
        <p className="text-sm text-center" style={{ color: "var(--color-destructive)" }}>
          Sala no encontrada. Verifica el código e intenta de nuevo.
        </p>
      )}
    </div>
  );
}
