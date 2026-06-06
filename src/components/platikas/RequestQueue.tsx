"use client";

import { useEffect, useState } from "react";
import { Mic, Check, X, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

interface StageRequest {
  id: string;
  user_id: string;
  message: string | null;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

interface RequestQueueProps {
  platikaId: string;
  onApprove?: (token: string, wsUrl: string) => void;
}

export function RequestQueue({ platikaId, onApprove }: RequestQueueProps) {
  const [requests, setRequests] = useState<StageRequest[]>([]);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Load pending requests
    supabase
      .from("platikas_requests")
      .select("*, profiles(display_name, avatar_url)")
      .eq("platikas_id", platikaId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setRequests(data as StageRequest[]);
      });

    // Subscribe to new requests + status changes
    const channel = supabase
      .channel(`requests:${platikaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platikas_requests",
          filter: `platikas_id=eq.${platikaId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const { data } = await supabase
              .from("platikas_requests")
              .select("*, profiles(display_name, avatar_url)")
              .eq("id", payload.new.id)
              .single();
            if (data && payload.new.status === "pending") {
              setRequests((prev) => [...prev, data as StageRequest]);
            }
          } else if (payload.eventType === "UPDATE") {
            // Remove from queue if no longer pending
            if (payload.new.status !== "pending") {
              setRequests((prev) => prev.filter((r) => r.id !== payload.new.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [platikaId]);

  async function approve(requestId: string) {
    setApproving(requestId);
    try {
      const res = await fetch(
        `/api/platikas/${platikaId}/requests/${requestId}/approve`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok && onApprove) {
        onApprove(data.token, data.wsUrl);
      }
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } finally {
      setApproving(null);
    }
  }

  async function reject(requestId: string) {
    const supabase = createClient();
    await supabase
      .from("platikas_requests")
      .update({ status: "rejected" })
      .eq("id", requestId);
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <Users size={15} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Cola de escenario
          </span>
        </div>
        {requests.length > 0 && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {requests.length}
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 max-h-64 overflow-y-auto">
        {requests.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: "var(--color-text-muted)" }}>
            Sin solicitudes pendientes
          </p>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: "rgba(212,160,23,0.2)", color: "var(--color-primary)" }}
              >
                {req.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                  {req.profiles?.display_name ?? "Usuario"}
                </p>
                {req.message && (
                  <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-text-muted)" }}>
                    {req.message}
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  {formatDate(req.created_at).split(",")[1]?.trim()}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => approve(req.id)}
                  disabled={approving === req.id}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: "rgba(74,222,128,0.15)", color: "var(--color-success)" }}
                  title="Aprobar"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => reject(req.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: "rgba(248,113,113,0.15)", color: "var(--color-destructive)" }}
                  title="Rechazar"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
