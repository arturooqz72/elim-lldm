"use client";

import { useState } from "react";
import { createFreshClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? "/";
  const hasError = searchParams.get("error") === "auth";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  function switchMode(next: "login" | "register") {
    setMode(next);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setMessage({ type: "error", text: "Ingresa tu correo y contraseña." });
      return;
    }
    if (cleanPassword.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (mode === "register" && cleanPassword !== confirmPassword.trim()) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }

    setLoading(true);
    try {
      const supabase = createFreshClient();
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: { full_name: cleanEmail.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/callback?returnUrl=${encodeURIComponent(returnUrl)}`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage({ type: "success", text: "¡Cuenta creada! Revisa tu correo para confirmarla antes de entrar." });
        } else {
          window.location.replace(returnUrl);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (error) throw error;
        window.location.replace(returnUrl);
      }
    } catch (err: unknown) {
      const msg = ((err as Error)?.message ?? "").toLowerCase();
      if (msg.includes("invalid login credentials") || msg.includes("invalid password")) {
        setMessage({ type: "error", text: "Correo o contraseña incorrectos." });
      } else if (msg.includes("already registered") || msg.includes("user already registered")) {
        setMessage({ type: "error", text: "Ese correo ya está registrado. Inicia sesión." });
      } else if (msg.includes("email not confirmed")) {
        setMessage({ type: "error", text: "Debes confirmar tu correo primero. Revisa tu bandeja de entrada." });
      } else if (msg.includes("rate limit")) {
        setMessage({ type: "error", text: "Demasiados intentos. Espera un momento e intenta de nuevo." });
      } else {
        setMessage({ type: "error", text: "Ocurrió un error. Intenta de nuevo." });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setSocialLoading(true);
    const supabase = createFreshClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback?returnUrl=${encodeURIComponent(returnUrl)}`,
      },
    });
    if (error) {
      setMessage({ type: "error", text: "No se pudo iniciar sesión con Google." });
      setSocialLoading(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setMessage({ type: "error", text: "Escribe tu correo arriba para recuperar tu contraseña." });
      return;
    }
    setLoading(true);
    try {
      const supabase = createFreshClient();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/callback?type=recovery`,
      });
      if (error) throw error;
      setMessage({ type: "success", text: "Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja." });
    } catch {
      setMessage({ type: "error", text: "No se pudo enviar el correo de recuperación." });
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
        href="/"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
        style={{ color: "var(--color-text-muted)" }}
      >
        <ArrowLeft size={14} />
        Inicio
      </Link>

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-5">
        {/* Logo */}
        <div className="text-center">
          <h1
            className="text-3xl font-bold tracking-widest"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
          >
            Elim LLDM
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {mode === "register"
              ? "Crea tu cuenta para participar"
              : "Inicia sesión para continuar"}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7 flex flex-col gap-5"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 0 60px rgba(0,0,0,0.3)",
          }}
        >
          {/* Messages */}
          {(hasError && !message) && (
            <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "var(--color-destructive)" }}>
              Hubo un problema al iniciar sesión. Intenta de nuevo.
            </div>
          )}
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

          {/* Google OAuth (login only) */}
          {mode === "login" && (
            <>
              <button
                onClick={handleGoogleLogin}
                disabled={socialLoading || loading}
                className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 font-semibold text-sm transition-all duration-200"
                style={{
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  opacity: socialLoading ? 0.7 : 1,
                }}
              >
                <GoogleIcon />
                {socialLoading ? "Conectando con Google…" : "Continuar con Google"}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
                <span className="text-xs font-medium tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  o entra con correo
                </span>
                <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
              </div>
            </>
          )}

          {/* Email / password form */}
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
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

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="w-full px-4 py-3 pr-10 rounded-xl text-sm outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {mode === "register" && (
              <input
                type="password"
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
              />
            )}

            <button
              type="submit"
              disabled={loading || socialLoading}
              className="w-full py-3 rounded-xl font-bold text-sm text-black transition-all duration-200"
              style={{ background: "var(--color-primary)", opacity: loading ? 0.7 : 1 }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(212,160,23,0.4)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {loading ? "Procesando…" : mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
            </button>
          </form>

          {/* Forgot password */}
          {mode === "login" && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-xs transition-opacity hover:opacity-75"
                style={{ color: "var(--color-primary)" }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}
        </div>

        {/* Toggle mode */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            className="text-sm font-semibold transition-opacity hover:opacity-75"
            style={{ color: "var(--color-primary)" }}
          >
            {mode === "register"
              ? "¿Ya tienes cuenta? Inicia sesión"
              : "¿No tienes cuenta? Regístrate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--color-bg)" }} />}>
      <LoginForm />
    </Suspense>
  );
}
