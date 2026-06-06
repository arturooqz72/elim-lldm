"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  is_moderated: boolean;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

interface ChatPanelProps {
  platikaId: string;
  currentUserId: string | null;
  isHost: boolean;
}

export function ChatPanel({ platikaId, currentUserId, isHost }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    // Load initial messages
    supabase
      .from("platikas_messages")
      .select("*, profiles(display_name, avatar_url)")
      .eq("platikas_id", platikaId)
      .eq("is_moderated", false)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) setMessages(data as ChatMessage[]);
      });

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat:${platikaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "platikas_messages",
          filter: `platikas_id=eq.${platikaId}`,
        },
        async (payload) => {
          // Fetch with profile info
          const { data } = await supabase
            .from("platikas_messages")
            .select("*, profiles(display_name, avatar_url)")
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setMessages((prev) => [...prev, data as ChatMessage]);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "platikas_messages",
          filter: `platikas_id=eq.${platikaId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id
                ? { ...m, is_moderated: payload.new.is_moderated }
                : m
            ).filter((m) => !m.is_moderated || isHost)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [platikaId, isHost]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !currentUserId || sending) return;

    setSending(true);
    const content = input.trim().slice(0, 500);
    setInput("");

    await supabase.from("platikas_messages").insert({
      platikas_id: platikaId,
      user_id: currentUserId,
      content,
    });

    setSending(false);
  }

  async function moderateMessage(id: string) {
    await supabase
      .from("platikas_messages")
      .update({ is_moderated: true })
      .eq("id", id);
  }

  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <MessageCircle size={16} style={{ color: "var(--color-primary)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Chat
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && (
          <p
            className="text-xs text-center py-6"
            style={{ color: "var(--color-text-muted)" }}
          >
            Sé el primero en comentar
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.user_id === currentUserId;
          const initial = msg.profiles?.display_name?.[0]?.toUpperCase() ?? "?";
          return (
            <div key={msg.id} className="flex items-start gap-2 group">
              {/* Avatar */}
              {msg.profiles?.avatar_url ? (
                <img
                  src={msg.profiles.avatar_url}
                  alt={msg.profiles.display_name}
                  className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5"
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: "var(--color-primary)", color: "#000" }}
                >
                  {initial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: isMine ? "var(--color-primary)" : "var(--color-text)",
                    }}
                  >
                    {isMine ? "Tú" : (msg.profiles?.display_name ?? "Usuario")}
                  </span>
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {formatDate(msg.created_at).split(",")[1]?.trim()}
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed break-words"
                  style={{ color: "var(--color-text)" }}
                >
                  {msg.content}
                </p>
              </div>
              {isHost && (
                <button
                  onClick={() => moderateMessage(msg.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 rounded transition-opacity shrink-0"
                  style={{
                    color: "var(--color-destructive)",
                    background: "rgba(248,113,113,0.1)",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {currentUserId ? (
        <form
          onSubmit={sendMessage}
          className="flex items-center gap-2 p-3 shrink-0"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            maxLength={500}
            disabled={sending}
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            onFocus={(e) => {
              (e.target as HTMLElement).style.borderColor = "var(--color-primary)";
            }}
            onBlur={(e) => {
              (e.target as HTMLElement).style.borderColor = "var(--color-border)";
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all shrink-0"
            style={{
              background: input.trim() ? "var(--color-primary)" : "var(--color-surface-elevated)",
              color: input.trim() ? "#000" : "var(--color-text-muted)",
            }}
          >
            <Send size={15} />
          </button>
        </form>
      ) : (
        <div
          className="p-3 text-center text-xs shrink-0"
          style={{
            borderTop: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <a href="/login" style={{ color: "var(--color-primary)" }}>
            Inicia sesión
          </a>{" "}
          para chatear
        </div>
      )}
    </div>
  );
}
