"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, BookOpen, Globe, Loader2, Send, Trash2, User } from "lucide-react";
import type { ElimIAMessage, ElimIAMode } from "@/types";

const GOLD = "#f5c842";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  initialMessages: Pick<ElimIAMessage, "mode" | "role" | "content">[];
  displayName: string;
}

const WELCOME: Record<ElimIAMode, string> = {
  lldm: "Hola, soy Elim IA en Modo LLDM. Respondo basándome únicamente en los documentos que el administrador ha subido a la plataforma.",
  general: "Hola, soy Elim IA en Modo General. Puedo ayudarte con cualquier tema y buscar información actualizada en internet.",
};

export function ElimIaChat({ initialMessages, displayName }: Props) {
  const [mode, setMode] = useState<ElimIAMode>("lldm");
  const [messages, setMessages] = useState<Record<ElimIAMode, ChatMsg[]>>(() => {
    const grouped: Record<ElimIAMode, ChatMsg[]> = { lldm: [], general: [] };
    for (const m of initialMessages) grouped[m.mode].push({ role: m.role, content: m.content });
    return grouped;
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mode, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => ({ ...prev, [mode]: [...prev[mode], { role: "user", content: text }] }));
    setLoading(true);

    try {
      const res = await fetch("/api/elim-ia/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, mode }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error ?? "Error al consultar Elim IA");
      setMessages((prev) => ({ ...prev, [mode]: [...prev[mode], { role: "assistant", content: data.reply! }] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al consultar Elim IA");
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    if (!confirm("¿Borrar todo el historial de esta conversación?")) return;
    await fetch("/api/elim-ia/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    setMessages((prev) => ({ ...prev, [mode]: [] }));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const currentMessages = messages[mode];

  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: `1px solid ${GOLD}33` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}55` }}
          >
            <Bot size={20} style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: "var(--color-text)" }}>
              Elim IA
            </h1>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Hola, {displayName}
            </p>
          </div>
        </div>

        <button
          onClick={clearHistory}
          className="p-2 rounded-lg transition-colors"
          style={{ color: "var(--color-text-muted)" }}
          title="Borrar historial"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <button
          onClick={() => setMode("lldm")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
          style={{
            background: mode === "lldm" ? GOLD : "var(--color-surface-elevated)",
            color: mode === "lldm" ? "#000" : "var(--color-text-muted)",
            border: `1px solid ${mode === "lldm" ? GOLD : "var(--color-border)"}`,
          }}
        >
          <BookOpen size={13} />
          Modo LLDM
        </button>
        <button
          onClick={() => setMode("general")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
          style={{
            background: mode === "general" ? GOLD : "var(--color-surface-elevated)",
            color: mode === "general" ? "#000" : "var(--color-text-muted)",
            border: `1px solid ${mode === "general" ? GOLD : "var(--color-border)"}`,
          }}
        >
          <Globe size={13} />
          Modo General
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {currentMessages.length === 0 && (
          <div className="flex gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}55` }}
            >
              <Bot size={15} style={{ color: GOLD }} />
            </div>
            <div
              className="px-4 py-3 rounded-2xl text-sm max-w-[80%]"
              style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
            >
              {WELCOME[mode]}
            </div>
          </div>
        )}

        {currentMessages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={
                m.role === "user"
                  ? { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }
                  : { background: `${GOLD}1A`, border: `1px solid ${GOLD}55` }
              }
            >
              {m.role === "user" ? (
                <User size={14} style={{ color: "var(--color-text-muted)" }} />
              ) : (
                <Bot size={15} style={{ color: GOLD }} />
              )}
            </div>
            <div
              className="px-4 py-3 rounded-2xl text-sm max-w-[80%] whitespace-pre-wrap"
              style={
                m.role === "user"
                  ? { background: GOLD, color: "#000" }
                  : { background: "var(--color-surface-elevated)", color: "var(--color-text)" }
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}55` }}
            >
              <Bot size={15} style={{ color: GOLD }} />
            </div>
            <div
              className="px-4 py-3 rounded-2xl text-sm flex items-center gap-2"
              style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
            >
              <Loader2 size={14} className="animate-spin" />
              Elim IA está escribiendo...
            </div>
          </div>
        )}

        {error && (
          <div
            className="px-4 py-3 rounded-2xl text-sm"
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "var(--color-destructive)",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-5 py-4 shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === "lldm" ? "Pregunta sobre los documentos de la iglesia..." : "Pregunta lo que quieras..."}
            rows={1}
            className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              maxHeight: "120px",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-3 rounded-xl shrink-0 transition-opacity disabled:opacity-40"
            style={{ background: GOLD, color: "#000" }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
