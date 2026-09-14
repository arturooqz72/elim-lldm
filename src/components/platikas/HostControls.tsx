"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StopCircle, Mic, Loader2 } from "lucide-react";
import { RequestQueue } from "./RequestQueue";
import { DestinationsPanel } from "./DestinationsPanel";
import { RadioBroadcastPanel } from "./RadioBroadcastPanel";
import { SpeakerControls } from "./SpeakerControls";
import type { ProgramaAudio } from "@/types";

interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  onGoLive?: () => void;
  onEnd?: () => void;
  onSpeakerApproved?: (token: string, wsUrl: string) => void;
  programaAudios?: ProgramaAudio[];
}

export function HostControls({
  platikaId,
  isLive,
  onGoLive,
  onEnd,
  onSpeakerApproved,
  programaAudios,
}: HostControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function goLive() {
    setLoading("live");
    try {
      const res = await fetch(`/api/platikas/${platikaId}/go-live`, { method: "POST" });
      if (res.ok) {
        onGoLive?.();
        // El badge "BACKSTAGE" y demas texto de la pagina se calculan en
        // el Server Component a partir de platikas.status — sin esto
        // quedarian obsoletos aunque los controles del cliente ya
        // cambiaron a "en vivo".
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function endPlatica() {
    if (!confirm("¿Terminar la plática? No podrá reanudarse.")) return;
    setLoading("end");
    try {
      await fetch(`/api/platikas/${platikaId}/end`, { method: "POST" });
      onEnd?.();
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Live / End controls */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Controles del anfitrión
        </p>

        <div className="flex flex-col gap-2">
          {!isLive ? (
            <>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Estás en backstage: prueba tu mic y cámara. Nadie más te ve ni te escucha todavía.
              </p>
              <button
                onClick={goLive}
                disabled={loading === "live"}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: "var(--color-primary)", color: "#000" }}
                onMouseEnter={(e) => {
                  if (loading !== "live") (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(212,160,23,0.4)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {loading === "live" ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                Salir al aire
              </button>
            </>
          ) : (
            <button
              onClick={endPlatica}
              disabled={loading === "end"}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: "rgba(248,113,113,0.15)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "var(--color-destructive)",
              }}
            >
              {loading === "end" ? <Loader2 size={16} className="animate-spin" /> : <StopCircle size={16} />}
              Terminar plática
            </button>
          )}

          {isLive && <RadioBroadcastPanel platikaId={platikaId} programaAudios={programaAudios} />}
        </div>
      </div>

      {/* Destinos de streaming — solo visible en vivo */}
      {isLive && <DestinationsPanel platikaId={platikaId} />}

      {/* Speakers on stage — mute/remove guests — only visible when live */}
      {isLive && <SpeakerControls platikaId={platikaId} />}

      {/* Request queue — only visible when live */}
      {isLive && (
        <RequestQueue
          platikaId={platikaId}
          onApprove={onSpeakerApproved}
        />
      )}
    </div>
  );
}
