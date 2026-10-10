"use client";

import { useState } from "react";
import { createFreshClient } from "@/lib/supabase/client";
import { PedirNombre } from "./PedirNombre";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  /** Adónde ir al terminar. */
  returnUrl: string;
  correoInicial?: string;
  /** true si ya se mandó el correo (recién registrado con contraseña): empieza en el código. */
  enviado?: boolean;
  /** Muestra el campo del correo (si no, usa correoInicial tal cual). */
  pedirCorreo?: boolean;
  /** Aviso cuando ya entró y se le está pidiendo el nombre (para ocultar lo demás). */
  onPidiendoNombre?: () => void;
}

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
 * Entrar con un código por correo, igual en /login y en la app de Elim
 * English. Sirve para todo: si el correo no tiene cuenta, se crea; si la
 * cuenta no estaba confirmada, escribir el código la confirma. Las cuentas
 * nuevas nacen con nombre_pendiente y, al entrar, aquí mismo se les pide su
 * nombre. Funciona dentro de la app instalada (no abre Safari).
 */
export function EntrarConCodigo({
  returnUrl,
  correoInicial = "",
  enviado: enviadoInicial = false,
  pedirCorreo,
  onPidiendoNombre,
}: Props) {
  const [correo, setCorreo] = useState(correoInicial);
  const [codigo, setCodigo] = useState("");
  const [paso, setPaso] = useState<"correo" | "codigo" | "nombre">(enviadoInicial ? "codigo" : "correo");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = correo.trim().toLowerCase();

  async function pedirCodigo() {
    if (!CORREO.test(email)) {
      setError("Escribe un correo válido.");
      return;
    }
    setCargando(true);
    setError(null);
    const { error: e } = await createFreshClient().auth.signInWithOtp({
      email,
      // data solo se aplica si la cuenta es nueva: nombre_pendiente hace que
      // se le pida su nombre al entrar (aquí o en /ingles).
      options: { shouldCreateUser: true, data: { full_name: email.split("@")[0], nombre_pendiente: true } },
    });
    setCargando(false);
    if (e) setError(mensajeError(e.message));
    else setPaso("codigo");
  }

  async function entrar() {
    const token = codigo.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Escribe el código completo que te llegó por correo.");
      return;
    }
    setCargando(true);
    setError(null);
    const { data, error: e } = await createFreshClient().auth.verifyOtp({ email, token, type: "email" });
    if (e) {
      setCargando(false);
      setError(mensajeError(e.message));
      return;
    }
    if (data.user?.user_metadata?.nombre_pendiente === true) {
      setCargando(false);
      setPaso("nombre");
      onPidiendoNombre?.();
      return;
    }
    window.location.replace(returnUrl);
  }

  if (paso === "nombre") return <PedirNombre onListo={() => window.location.replace(returnUrl)} />;

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
        void (paso === "codigo" ? entrar() : pedirCodigo());
      }}
    >
      {paso === "correo" ? (
        <>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {pedirCorreo
              ? "Escribe tu correo y te mandamos un código para entrar. No necesitas contraseña."
              : <>Pide un código a <strong style={{ color: "var(--color-text)" }}>{correo}</strong>: al escribirlo, tu correo queda confirmado y entras de una vez.</>}
          </p>
          {pedirCorreo && (
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Tu correo"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base outline-none"
              style={estiloCampo}
              aria-label="Tu correo"
            />
          )}
        </>
      ) : (
        <>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Te mandamos un código a <strong style={{ color: "var(--color-text)" }}>{correo}</strong>. Escríbelo aquí
            (si no lo ves, revisa también la carpeta de spam).
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
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        {cargando ? "Un momento…" : paso === "codigo" ? "Entrar" : "Mandarme un código"}
      </button>

      {paso === "codigo" && (
        <button
          type="button"
          onClick={() => {
            setCodigo("");
            setError(null);
            if (pedirCorreo) setPaso("correo");
            else void pedirCodigo();
          }}
          className="text-sm hover:underline"
          style={{ color: "var(--color-text-muted)" }}
        >
          {pedirCorreo ? "Usar otro correo o pedir otro código" : "Mandarme otro código"}
        </button>
      )}
    </form>
  );
}
