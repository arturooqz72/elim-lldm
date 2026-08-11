"use client";

import { useState } from "react";
import { Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NOMBRE_MAX = 120;
const MENSAJE_MAX = 2000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched] = useState(false);

  const nombreOk = nombre.trim().length > 0 && nombre.trim().length <= NOMBRE_MAX;
  const correoOk = EMAIL_RE.test(correo.trim());
  const mensajeOk = mensaje.trim().length > 0 && mensaje.trim().length <= MENSAJE_MAX;
  const canSubmit = status !== "submitting";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);

    if (!nombreOk || !correoOk || !mensajeOk) {
      setStatus("error");
      setErrorMsg(
        !correoOk && nombreOk && mensajeOk
          ? "Ingresa un correo válido."
          : "Completa todos los campos antes de enviar."
      );
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.from("sugerencias").insert({
      nombre: nombre.trim(),
      correo: correo.trim(),
      mensaje: mensaje.trim(),
    });

    if (error) {
      setStatus("error");
      setErrorMsg("No pudimos enviar tu mensaje. Intenta de nuevo en unos minutos.");
      return;
    }

    setStatus("success");
    setNombre("");
    setCorreo("");
    setMensaje("");
    setTouched(false);
  }

  if (status === "success") {
    return (
      <div
        className="rounded-2xl p-8 flex flex-col items-center text-center gap-3"
        style={{
          background: "var(--color-surface)",
          border: "1px solid rgba(74,222,128,0.3)",
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "rgba(74,222,128,0.12)" }}
        >
          <CheckCircle2 size={24} style={{ color: "var(--color-success)" }} />
        </div>
        <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
          ¡Gracias por tu sugerencia!
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Recibimos tu mensaje y lo revisaremos pronto.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-2 text-sm font-medium"
          style={{ color: "var(--color-primary)" }}
        >
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Field label="Nombre" required>
        <input
          type="text"
          name="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={NOMBRE_MAX}
          placeholder="Tu nombre"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          style={inputStyle(touched && !nombreOk)}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
          onBlur={(e) =>
            (e.currentTarget.style.borderColor =
              touched && !nombreOk ? "var(--color-destructive)" : "var(--color-border)")
          }
        />
      </Field>

      <Field label="Correo" required>
        <input
          type="email"
          name="correo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          style={inputStyle(touched && !correoOk)}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
          onBlur={(e) =>
            (e.currentTarget.style.borderColor =
              touched && !correoOk ? "var(--color-destructive)" : "var(--color-border)")
          }
        />
        {touched && correo.length > 0 && !correoOk && (
          <p className="text-xs mt-1" style={{ color: "var(--color-destructive)" }}>
            Ingresa un correo válido.
          </p>
        )}
      </Field>

      <Field label="Mensaje" required>
        <textarea
          name="mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={MENSAJE_MAX}
          rows={6}
          placeholder="Cuéntanos tu sugerencia, comentario o petición de oración…"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-colors"
          style={inputStyle(touched && !mensajeOk)}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
          onBlur={(e) =>
            (e.currentTarget.style.borderColor =
              touched && !mensajeOk ? "var(--color-destructive)" : "var(--color-border)")
          }
        />
        <div className="flex justify-end mt-1">
          <span
            className="text-xs font-mono"
            style={{
              color:
                mensaje.length > MENSAJE_MAX
                  ? "var(--color-destructive)"
                  : "var(--color-text-muted)",
            }}
          >
            {mensaje.length}/{MENSAJE_MAX}
          </span>
        </div>
      </Field>

      {status === "error" && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "var(--color-destructive)",
          }}
        >
          <AlertCircle size={16} className="shrink-0" />
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
        style={{
          background: canSubmit ? "var(--color-primary)" : "var(--color-surface-elevated)",
          color: canSubmit ? "#000" : "var(--color-text-muted)",
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
        onMouseEnter={(e) => {
          if (canSubmit)
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(212,160,23,0.4)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {status === "submitting" ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Send size={15} />
        )}
        {status === "submitting" ? "Enviando…" : "Enviar sugerencia"}
      </button>
    </form>
  );
}

function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    background: "var(--color-surface-elevated)",
    border: `1px solid ${invalid ? "var(--color-destructive)" : "var(--color-border)"}`,
    color: "var(--color-text)",
  };
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
        {label}
        {required && <span style={{ color: "var(--color-live)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
