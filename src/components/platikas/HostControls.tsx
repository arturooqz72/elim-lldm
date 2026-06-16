"use client";

import { useEffect, useState } from "react";
import { Radio, StopCircle, Mic, MicOff, Loader2, PlaySquare, Globe, Music2 } from "lucide-react";
import { RequestQueue } from "./RequestQueue";
import { PlatformStreamCard } from "./PlatformStreamCard";
import { createClient } from "@/lib/supabase/client";

type StreamPlatform = "youtube" | "facebook" | "tiktok";

const STREAM_PLATFORMS: {
  key: StreamPlatform;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  accentColor: string;
  defaultRtmpUrl: string;
}[] = [
  {
    key: "youtube",
    label: "YouTube",
    icon: PlaySquare,
    accentColor: "#FF0000",
    defaultRtmpUrl: "rtmp://a.rtmp.youtube.com/live2",
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: Globe,
    accentColor: "#1877F2",
    defaultRtmpUrl: "rtmps://live-api-s.facebook.com:443/rtmp/",
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: Music2,
    accentColor: "#69C9D0",
    defaultRtmpUrl: "rtmps://push.rtmp.tiktok.com/live/",
  },
];

interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  radioOutputActive: boolean;
  onGoLive?: () => void;
  onEnd?: () => void;
  onSpeakerApproved?: (token: string, wsUrl: string) => void;
}

export function HostControls({
  platikaId,
  isLive,
  radioOutputActive,
  onGoLive,
  onEnd,
  onSpeakerApproved,
}: HostControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [radioActive, setRadioActive] = useState(radioOutputActive);
  const [streamEgressIds, setStreamEgressIds] = useState<Record<StreamPlatform, string | null>>({
    youtube: null,
    facebook: null,
    tiktok: null,
  });

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("platikas")
      .select("youtube_egress_id, facebook_egress_id, tiktok_egress_id")
      .eq("id", platikaId)
      .single()
      .then(({ data }) => {
        if (data) {
          setStreamEgressIds({
            youtube: data.youtube_egress_id,
            facebook: data.facebook_egress_id,
            tiktok: data.tiktok_egress_id,
          });
        }
      });

    const channel = supabase
      .channel(`platikas-stream:${platikaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "platikas",
          filter: `id=eq.${platikaId}`,
        },
        (payload) => {
          setStreamEgressIds({
            youtube: payload.new.youtube_egress_id,
            facebook: payload.new.facebook_egress_id,
            tiktok: payload.new.tiktok_egress_id,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [platikaId]);

  async function goLive() {
    setLoading("live");
    try {
      const res = await fetch(`/api/platikas/${platikaId}/go-live`, { method: "POST" });
      if (res.ok) onGoLive?.();
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
    } finally {
      setLoading(null);
    }
  }

  async function toggleRadio() {
    setLoading("radio");
    try {
      const res = await fetch(`/api/platikas/${platikaId}/radio-toggle`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRadioActive(data.radio_output_active);
      }
    } finally {
      setLoading(null);
    }
  }

  async function toggleStream(platform: StreamPlatform, rtmpUrl: string, streamKey: string) {
    const isActive = !!streamEgressIds[platform];
    setLoading(`stream-${platform}`);
    try {
      const res = await fetch(`/api/platikas/${platikaId}/stream-toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isActive
            ? { platform, action: "stop", rtmpUrl: "", streamKey: "" }
            : { platform, action: "start", rtmpUrl, streamKey }
        ),
      });
      if (res.ok) {
        const data = await res.json();
        setStreamEgressIds((prev) => ({
          ...prev,
          [platform]: data[`${platform}_egress_id`] ?? null,
        }));
      }
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
              Ir en Vivo
            </button>
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

          {isLive && (
            <button
              onClick={toggleRadio}
              disabled={loading === "radio"}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: radioActive ? "rgba(212,160,23,0.15)" : "var(--color-surface-elevated)",
                border: `1px solid ${radioActive ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
                color: radioActive ? "var(--color-primary)" : "var(--color-text-muted)",
              }}
            >
              {loading === "radio" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : radioActive ? (
                <Radio size={14} />
              ) : (
                <MicOff size={14} />
              )}
              {radioActive ? "Salida a radio: ON" : "Salida a radio: OFF"}
            </button>
          )}
        </div>
      </div>

      {/* Stream to platforms — only visible when live */}
      {isLive && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Transmisión a plataformas
          </p>

          <div className="flex flex-col gap-2.5">
            {STREAM_PLATFORMS.map((platform) => (
              <PlatformStreamCard
                key={platform.key}
                label={platform.label}
                icon={platform.icon}
                accentColor={platform.accentColor}
                defaultRtmpUrl={platform.defaultRtmpUrl}
                isActive={!!streamEgressIds[platform.key]}
                loading={loading === `stream-${platform.key}`}
                onToggle={(rtmpUrl, streamKey) => toggleStream(platform.key, rtmpUrl, streamKey)}
              />
            ))}
          </div>
        </div>
      )}

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
