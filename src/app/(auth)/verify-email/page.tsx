"use client";

import { useState } from "react";
import { createFreshClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!email || !code) {
      setMessage({ type: "error", text: "Ingresa tu correo y el código de verificación." });
      return;
    }
    setLoading(true);
    try {
      const supabase = createFreshClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      setMessage({ type: "success", text: "¡Cuenta verificada! Redirigiendo…" });
      setTimeout(() => { window.location.replace("/"); }, 1500);
    } catch {
      setMessage({ type: "error", text: "Código inválido o expirado. Solicita un nuevo correo de verificación." });
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,160,23,0.07) 0%, transparent 60%)",
        }}
      />

      <Link
        href="/login"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
        style={{ color: "var(--color-text-muted)" }}
      >
        <ArrowLeft size={14} />
        Volver
      </Link>

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-5">
        <div className="text-center">
          <h1
            className="text-3xl font-bold tracking-widest"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
          >
            Elim LLDM
          </h1>
        </div>

        <div
          className="rounded-2xl p-7 flex flex-col gap-5"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 0 60px rgba(0,0,0,0.3)",
          }}
        >
          <div className="text-center">
            <div
              className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.25)" }}
            >
              ✉️
            </div>
            <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
              Verifica tu correo
            </h2>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              Ingresa el código de 6 dígitos que te enviamos a tu correo.
            </p>
          </div>

          {message && (
            <div
              className="px-4 py-3 rounded-xl text-xs leading-relaxed"
              style={{
                background: message.type === "error" ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)",
                border: `1px solid ${message.type === "error" ? "rgba(248,113,113,0.25)" : "rgba(74,222,128,0.25)"}`,
                color: message.type === "error" ? "var(--color-destructive)" : "var(--color-success)",
              }}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
            <input
              type="text"
              placeholder="Código de verificación"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              inputMode="numeric"
              maxLength={6}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors text-center tracking-[0.4em] font-mono"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-black transition-all duration-200"
              style={{ background: "var(--color-primary)", opacity: loading ? 0.7 : 1 }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(212,160,23,0.4)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {loading ? "Verificando…" : "Verificar cuenta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
