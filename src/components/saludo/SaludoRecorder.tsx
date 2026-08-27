"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Send, AlertCircle, RotateCcw } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { pickMimeType, extensionForMimeType, formatTime } from "@/lib/audio-recording";
import { SaludoSuccessCard } from "@/components/saludo/SaludoSuccessCard";

const NOMBRE_MAX = 120;
const MAX_SECONDS = 60;

type Status = "idle" | "recording" | "recorded" | "submitting" | "success";

export function SaludoRecorder() {
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
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
  const audioUrlRef = useRef<string | null>(null);

  const nombreOk = nombre.trim().length > 0 && nombre.trim().length <= NOMBRE_MAX;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
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
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      setAudioUrl(url);
      setStatus("recorded");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    recorder.start();
    setElapsed(0);
    setStatus("recording");

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }

  function stopRecording() {
    stopTimer();
    mediaRecorderRef.current?.stop();
  }

  useEffect(() => {
    if (status === "recording" && elapsed >= MAX_SECONDS) {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, status]);

  function discardRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrlRef.current = null;
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

    if (elapsed < 1) {
      setErrorMsg("Tu grabación es muy corta, intenta de nuevo.");
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    const ext = extensionForMimeType(mimeTypeRef.current);
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const supabase = createFreshClient();
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
      contacto: contacto.trim() || null,
    });

    if (insertError) {
      await supabase.storage.from("saludos").remove([path]);
      setStatus("recorded");
      setErrorMsg("No pudimos guardar tu saludo. Intenta de nuevo en unos minutos.");
      return;
    }

    if (contacto.trim()) {
      fetch("/api/saludos/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), contacto: contacto.trim() }),
      }).catch(() => {
        // Best-effort: el saludo ya se guardó, un correo fallido no debe bloquear al usuario.
      });
    }

    setStatus("success");
  }

  function recordAnother() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrlRef.current = null;
    audioBlobRef.current = null;
    setAudioUrl(null);
    setElapsed(0);
    setNombre("");
    setContacto("");
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
    return <SaludoSuccessCard onRecordAnother={recordAnother} />;
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

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Correo o WhatsApp (opcional)
        </label>
        <input
          type="text"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          disabled={recording || hasRecording}
          maxLength={200}
          placeholder="Para poder agradecerte tu saludo"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
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
