"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

interface JoinCodeFormProps {
  defaultCode?: string;
  notFound?: boolean;
  serverError?: string;
}

export function JoinCodeForm({ defaultCode = "", notFound, serverError }: JoinCodeFormProps) {
  const [code, setCode] = useState(defaultCode.toUpperCase());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    startTransition(() => {
      router.push(`/juegos?code=${encodeURIComponent(code.trim())}`);
    });
  }

  const hasError = notFound || !!serverError;

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={code}
          onChange={handleChange}
          placeholder="Ej: ELIM42"
          maxLength={8}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 rounded-xl px-4 py-3 text-base font-mono font-bold uppercase outline-none transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: `1px solid ${hasError ? "var(--color-destructive)" : "var(--color-border)"}`,
            color: "var(--color-text)",
            letterSpacing: "0.15em",
          }}
          onFocus={(e) => {
            if (!hasError)
              e.currentTarget.style.borderColor = "var(--color-primary)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = hasError
              ? "var(--color-destructive)"
              : "var(--color-border)";
          }}
        />
        <button
          type="submit"
          disabled={!code.trim() || isPending}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{
            background:
              !code.trim() || isPending
                ? "var(--color-surface-elevated)"
                : "var(--color-primary)",
            color: !code.trim() || isPending ? "var(--color-text-muted)" : "#000",
            cursor: !code.trim() || isPending ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (code.trim() && !isPending)
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 0 20px rgba(212,160,23,0.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          {isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              Entrar
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      {notFound && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          Código no encontrado o la partida ya terminó. Verifica e intenta de nuevo.
        </p>
      )}
      {serverError && !notFound && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {serverError}
        </p>
      )}

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Los códigos son de 6 caracteres, como{" "}
        <span className="font-mono font-bold" style={{ color: "var(--color-text)" }}>
          ELIM42
        </span>
        . Los encontrarás con el organizador de la partida.
      </p>
    </div>
  );
}
