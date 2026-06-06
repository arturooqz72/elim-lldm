"use client";

import { useState } from "react";
import { Mic, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface RequestButtonProps {
  platikaId: string;
  currentUserId: string;
}

type Status = "idle" | "sending" | "sent" | "error";

export function RequestButton({ platikaId, currentUserId }: RequestButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function sendRequest() {
    setStatus("sending");
    const supabase = createClient();

    const { error } = await supabase.from("platikas_requests").insert({
      platikas_id: platikaId,
      user_id: currentUserId,
      message: message.trim() || null,
    });

    if (error) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("sent");
      setShowForm(false);
    }
  }

  if (status === "sent") {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
        style={{
          background: "rgba(74,222,128,0.1)",
          border: "1px solid rgba(74,222,128,0.3)",
          color: "var(--color-success)",
        }}
      >
        <CheckCircle size={16} />
        Solicitud enviada — el anfitrión te notificará
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{
            background: "rgba(212,160,23,0.1)",
            border: "1px solid rgba(212,160,23,0.3)",
            color: "var(--color-primary)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(212,160,23,0.18)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(212,160,23,0.1)";
          }}
        >
          <Mic size={16} />
          Solicitar subir al escenario
        </button>
      ) : (
        <div
          className="flex flex-col gap-3 p-4 rounded-xl"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Solicitar subir al escenario
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="¿Sobre qué quieres hablar? (opcional)"
            maxLength={200}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition-colors"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: "var(--color-surface)",
                color: "var(--color-text-muted)",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={sendRequest}
              disabled={status === "sending"}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              {status === "sending" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Mic size={14} />
              )}
              Enviar solicitud
            </button>
          </div>
          {status === "error" && (
            <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
              Error al enviar. Intenta de nuevo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
