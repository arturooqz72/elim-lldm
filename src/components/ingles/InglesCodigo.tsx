"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GOLD = "#f5c842";
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mensajes de Supabase Auth → español. */
function mensajeError(texto: string): string {
  const t = texto.toLowerCase();
  const segundos = t.match(/after (\d+) seconds?/)?.[1];
  if (segundos) return `Espera ${segundos} segundos antes de pedir otro código.`;
  if (t.includes("expired") || t.includes("invalid")) return "El código no es válido o ya venció. Revísalo o pide otro.";
  if (t.includes("rate limit")) return "Se pidieron muchos códigos. Intenta de nuevo en unos minutos.";
  return "No se pudo completar. Revisa tu conexión e intenta de nuevo.";
}

/**
 * Inicio de sesión con un código por correo, sin salir de la app instalada.
 * En iPhone, /login, Google y el enlace del correo abren Safari (fuera de la
 * app) y la sesión no regresa a la app; el código se escribe aquí mismo.
 * Si el correo no tiene cuenta, se crea al confirmar el código.
 */
export function InglesCodigo() {
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pedirCodigo() {
    const email = correo.trim().toLowerCase();
    if (!CORREO.test(email)) {
      setError("Escribe un correo válido.");
      return;
    }
    setCargando(true);
    setError(null);
    const { error: e } = await createClient().auth.signInWithOtp({
      email,
      // data solo se aplica si la cuenta es nueva: nombre_pendiente hace que
      // /ingles le pida su nombre antes de empezar (ver InglesNombre).
      options: { shouldCreateUser: true, data: { full_name: email.split("@")[0], nombre_pendiente: true } },
    });
    setCargando(false);
    if (e) setError(mensajeError(e.message));
    else setEnviado(true);
  }

  async function entrar() {
    const token = codigo.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Escribe el código completo que te llegó por correo.");
      return;
    }
    setCargando(true);
    setError(null);
    const { error: e } = await createClient().auth.verifyOtp({ email: correo.trim().toLowerCase(), token, type: "email" });
    if (e) {
      setCargando(false);
      setError(mensajeError(e.message));
      return;
    }
    // La sesión ya está en las cookies: al recargar, el servidor muestra la tutora.
    window.location.replace("/ingles");
  }

  const campo = "w-full px-4 py-3 rounded-xl text-base outline-none";
  const estiloCampo = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  };

  return (
    <form
      className="w-full flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void (enviado ? entrar() : pedirCodigo());
      }}
    >
      {!enviado ? (
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Tu correo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className={campo}
          style={estiloCampo}
          aria-label="Tu correo"
        />
      ) : (
        <>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Te mandamos un código a <strong style={{ color: "var(--color-text)" }}>{correo.trim()}</strong>. Escríbelo
            aquí (revisa también la carpeta de spam).
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Código"
            maxLength={10}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            className={`${campo} text-center tracking-[0.3em] font-semibold`}
            style={estiloCampo}
            aria-label="Código del correo"
          />
        </>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--color-destructive)" }} role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="w-full py-3.5 rounded-xl text-base font-bold disabled:opacity-60"
        style={{ background: GOLD, color: "#000" }}
      >
        {cargando ? "Un momento…" : enviado ? "Entrar" : "Enviarme un código"}
      </button>

      {enviado && (
        <button
          type="button"
          onClick={() => {
            setEnviado(false);
            setCodigo("");
            setError(null);
          }}
          className="text-sm hover:underline"
          style={{ color: "var(--color-text-muted)" }}
        >
          Usar otro correo o pedir otro código
        </button>
      )}
    </form>
  );
}
