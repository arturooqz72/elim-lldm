"use client";

import { useState } from "react";
import { createFreshClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }
    setLoading(true);
    try {
      const supabase = createFreshClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setMessage({ type: "success", text: "Contraseña actualizada correctamente. Redirigiendo…" });
      setTimeout(() => { window.location.replace("/"); }, 2000);
    } catch {
      setMessage({ type: "error", text: "No se pudo actualizar la contraseña. El enlace puede haber expirado." });
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
      className="min-h-screen flex items-center justify-center px-4 py-12 relative"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,160,23,0.07) 0%, transparent 60%)",
        }}
      />

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
              🔑
            </div>
            <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
              Nueva contraseña
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
              Elige una contraseña segura para tu cuenta.
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

          {!done && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nueva contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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
                {loading ? "Actualizando…" : "Actualizar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
