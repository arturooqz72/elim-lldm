"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Radio, Loader2, AlertCircle } from "lucide-react";
import {
  AudioMixer,
  connectRadioBridge,
  startStreamingToBridge,
  SALUDO_DIRECTO_DURATION_MS,
} from "@/lib/radio-broadcast";
// createFreshClient(), no el singleton: su initializePromise puede
// quedarse colgado indefinidamente (ver comentario en client.ts), lo que
// dejaría el botón trabado en "Conectando…" para siempre — mismo motivo
// que OpinionForm.tsx, LikeButton.tsx, etc.
import { createFreshClient } from "@/lib/supabase/client";

type Status = "idle" | "connecting" | "live" | "error";

export function SaludoDirectoButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(SALUDO_DIRECTO_DURATION_MS / 1000);

  const wsRef = useRef<WebSocket | null>(null);
  const mixerRef = useRef<AudioMixer | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cutoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function cleanup() {
    if (cutoffTimerRef.current) clearTimeout(cutoffTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    cutoffTimerRef.current = null;
    countdownTimerRef.current = null;

    recorderRef.current?.stop();
    recorderRef.current = null;

    mixerRef.current?.close();
    mixerRef.current = null;

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    wsRef.current?.close(1000, "saludo-directo-done");
    wsRef.current = null;
  }

  useEffect(() => () => cleanup(), []);

  async function start() {
    setStatus("connecting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/saludo-directo/radio-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo conectar con la radio");

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      const ws = await connectRadioBridge(data.wsUrl, data.key, "saludo_directo");
      wsRef.current = ws;

      const mixer = new AudioMixer();
      mixerRef.current = mixer;
      mixer.connect("mic", micStream);
      recorderRef.current = startStreamingToBridge(mixer.destination.stream, ws);

      ws.addEventListener("close", () => {
        if (wsRef.current !== ws) return;
        cleanup();
        setStatus("idle");
      });

      const supabase = createFreshClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          await supabase.from("saludos_directos").insert({ user_id: user.id });
        } catch (auditErr) {
          console.error("No se pudo registrar el saludo en la bitácora:", auditErr);
        }
      }

      setStatus("live");
      setSecondsLeft(SALUDO_DIRECTO_DURATION_MS / 1000);

      countdownTimerRef.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);

      cutoffTimerRef.current = setTimeout(() => {
        cleanup();
        setStatus("idle");
      }, SALUDO_DIRECTO_DURATION_MS);
    } catch (err) {
      cleanup();
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "No se pudo conectar con la radio");
    }
  }

  if (status === "live") {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
        style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)" }}
      >
        <span className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--color-live)" }}>
          <Radio size={16} className="animate-pulse" />
          AL AIRE
        </span>
        <span className="text-5xl font-bold" style={{ color: "var(--color-text)" }}>
          {secondsLeft}
        </span>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Tu micrófono está sonando en la radio ahora mismo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={start}
        disabled={status === "connecting"}
        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
        style={{ background: "var(--color-primary)", color: "#000", opacity: status === "connecting" ? 0.7 : 1 }}
      >
        {status === "connecting" ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
        {status === "connecting" ? "Conectando…" : "Dejar saludo en vivo (5s)"}
      </button>
      {status === "error" && errorMsg && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "var(--color-destructive)" }}
        >
          <AlertCircle size={14} className="shrink-0" />
          {errorMsg}
        </div>
      )}
    </div>
  );
}
