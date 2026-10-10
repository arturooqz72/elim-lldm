"use client";

import { useState } from "react";
import { createFreshClient } from "@/lib/supabase/client";

interface Props {
  email: string;
  /** true si Supabase ya mandó el correo (recién registrado); si no, primero se pide. */
  enviado: boolean;
  returnUrl: string;
}

function mensajeError(texto: string): string {
  const t = texto.toLowerCase();
  const segundos = t.match(/after (\d+) seconds?/)?.[1];
  if (segundos) return `Espera ${segundos} segundos antes de pedir otro código.`;
  if (t.includes("expired") || t.includes("invalid")) return "El código no es válido o ya venció. Revísalo o pide otro.";
  if (t.includes("rate limit")) return "Se pidieron muchos códigos. Intenta de nuevo en unos minutos.";
  return "No se pudo completar. Intenta de nuevo.";
}

/**
 * Confirmar el correo escribiendo el código que llega por correo (registro
 * nuevo o cuenta que nunca se confirmó). Escribir el código confirma la
 * cuenta y deja la sesión iniciada: ya no hace falta abrir el enlace.
 */
export function CodigoConfirmacion({ email, enviado: enviadoInicial, returnUrl }: Props) {
  const [enviado, setEnviado] = useState(enviadoInicial);
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pedir() {
    setCargando(true);
    setError(null);
    const { error: e } = await createFreshClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setCargando(false);
    if (e) setError(mensajeError(e.message));
    else setEnviado(true);
  }

  async function confirmar() {
    const token = codigo.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Escribe el código completo que te llegó por correo.");
      return;
    }
    setCargando(true);
    setError(null);
    const { error: e } = await createFreshClient().auth.verifyOtp({ email, token, type: "email" });
    if (e) {
      setCargando(false);
      setError(mensajeError(e.message));
      return;
    }
    window.location.replace(returnUrl);
  }

  const estiloCampo = {
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  };

  return (
    <div
      className="px-4 py-4 rounded-xl flex flex-col gap-3"
      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
    >
      {!enviado ? (
        <>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text)" }}>
            Pide un código a <strong>{email}</strong>: al escribirlo, tu correo queda confirmado y entras de una vez.
          </p>
          <button
            type="button"
            onClick={() => void pedir()}
            disabled={cargando}
            className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {cargando ? "Enviando…" : "Mandarme un código"}
          </button>
        </>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void confirmar();
          }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text)" }}>
            Escribe el código que te mandamos a <strong>{email}</strong>. Si no lo ves, revisa también la carpeta de
            spam.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Código"
            maxLength={10}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            className="w-full px-4 py-3 rounded-xl text-base text-center tracking-[0.3em] font-semibold outline-none"
            style={estiloCampo}
            aria-label="Código del correo"
          />
          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {cargando ? "Un momento…" : "Confirmar y entrar"}
          </button>
          <button
            type="button"
            onClick={() => void pedir()}
            disabled={cargando}
            className="text-xs hover:underline"
            style={{ color: "var(--color-text-muted)" }}
          >
            Mandarme otro código
          </button>
        </form>
      )}
      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
