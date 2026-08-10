"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Send, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NOMBRE_MAX = 120;
const MAX_SECONDS = 60;

type Status = "idle" | "recording" | "recorded" | "submitting" | "success";

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm", "audio/ogg", "audio/mp4"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function SaludoRecorder() {
  const [nombre, setNombre] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("");

  const nombreOk = nombre.trim().length > 0 && nombre.trim().length <= NOMBRE_MAX;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    setTouched(true);
    if (!nombreOk) {
      setErrorMsg("Escribe tu nombre antes de grabar.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorMsg("Tu navegador no soporta grabación de audio. Prueba con Chrome, Edge o Firefox actualizados.");
      return;
    }

    setErrorMsg("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg("No pudimos acceder a tu micrófono. Revisa los permisos del navegador para este sitio y vuelve a intentar.");
      return;
    }

    const mimeType = pickMimeType();
    mimeTypeRef.current = mimeType;
    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
      audioBlobRef.current = blob;
      setAudioUrl(URL.createObjectURL(blob));
      setStatus("recorded");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    recorder.start();
    setElapsed(0);
    setStatus("recording");

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_SECONDS) stopRecording();
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    stopTimer();
    mediaRecorderRef.current?.stop();
  }

  function discardRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioBlobRef.current = null;
    setAudioUrl(null);
    setElapsed(0);
    setErrorMsg("");
    setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const blob = audioBlobRef.current;
    if (!blob) return;

    setStatus("submitting");
    setErrorMsg("");

    const ext = extensionForMimeType(mimeTypeRef.current);
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from("saludos").upload(path, blob, {
      contentType: mimeTypeRef.current || "audio/webm",
    });

    if (uploadError) {
      setStatus("recorded");
      setErrorMsg("No pudimos subir tu audio. Intenta de nuevo en unos minutos.");
      return;
    }

    const { error: insertError } = await supabase.from("saludos").insert({
      nombre: nombre.trim(),
      audio_path: path,
      duration_seconds: elapsed,
    });

    if (insertError) {
      setStatus("recorded");
      setErrorMsg("No pudimos guardar tu saludo. Intenta de nuevo en unos minutos.");
      return;
    }

    setStatus("success");
  }

  function recordAnother() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioBlobRef.current = null;
    setAudioUrl(null);
    setElapsed(0);
    setNombre("");
    setTouched(false);
    setErrorMsg("");
    setStatus("idle");
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--color-surface-elevated)",
    border: `1px solid ${touched && !nombreOk ? "var(--color-destructive)" : "var(--color-border)"}`,
    color: "var(--color-text)",
  };

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
          ¡Gracias por tu saludo!
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Lo recibimos y podría sonar pronto en la radio.
        </p>
        <button
          onClick={recordAnother}
          className="mt-2 text-sm font-medium"
          style={{ color: "var(--color-primary)" }}
        >
          Grabar otro saludo
        </button>
      </div>
    );
  }

  const recording = status === "recording";
  const submitting = status === "submitting";
  const hasRecording = status === "recorded" || submitting;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Nombre
          <span style={{ color: "var(--color-live)" }}> *</span>
        </label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={recording || hasRecording}
          maxLength={NOMBRE_MAX}
          placeholder="Tu nombre"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          style={inputStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = touched && !nombreOk ? "var(--color-destructive)" : "var(--color-border)";
          }}
        />
      </div>

      <div
        className="flex flex-col items-center gap-4 py-8 rounded-2xl"
        style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
      >
        {status === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Mic size={18} />
            Grabar saludo
          </button>
        )}

        {recording && (
          <>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "var(--color-live)" }} />
              <span className="text-2xl font-mono" style={{ color: "var(--color-text)" }}>
                {formatTime(elapsed)} / {formatTime(MAX_SECONDS)}
              </span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-destructive)", color: "#000" }}
            >
              <Square size={16} />
              Detener
            </button>
          </>
        )}

        {hasRecording && audioUrl && (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={audioUrl} className="w-full" />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={discardRecording}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                <RotateCcw size={15} />
                Grabar de nuevo
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {submitting ? "Enviando…" : "Enviar saludo"}
              </button>
            </div>
          </>
        )}
      </div>

      {errorMsg && (
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
    </form>
  );
}
