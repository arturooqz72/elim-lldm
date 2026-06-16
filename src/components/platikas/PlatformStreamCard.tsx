"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface PlatformStreamCardProps {
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  accentColor: string;
  defaultRtmpUrl: string;
  isActive: boolean;
  loading: boolean;
  onToggle: (rtmpUrl: string, streamKey: string) => void;
}

export function PlatformStreamCard({
  label,
  icon: Icon,
  accentColor,
  defaultRtmpUrl,
  isActive,
  loading,
  onToggle,
}: PlatformStreamCardProps) {
  const [rtmpUrl, setRtmpUrl] = useState(defaultRtmpUrl);
  const [streamKey, setStreamKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2.5"
      style={{
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}1A` }}
        >
          <Icon size={14} style={{ color: accentColor }} />
        </div>
        <span className="text-sm font-semibold flex-1" style={{ color: "var(--color-text)" }}>
          {label}
        </span>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "animate-pulse" : ""}`}
          style={{ background: isActive ? "var(--color-success)" : "var(--color-border)" }}
          title={isActive ? "Transmitiendo" : "Inactivo"}
        />
      </div>

      <input
        type="text"
        value={rtmpUrl}
        onChange={(e) => setRtmpUrl(e.target.value)}
        disabled={isActive || loading}
        placeholder="URL RTMP"
        className="w-full px-3 py-2 rounded-lg text-xs"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      />

      <div className="relative">
        <input
          type={showKey ? "text" : "password"}
          value={streamKey}
          onChange={(e) => setStreamKey(e.target.value)}
          disabled={isActive || loading}
          placeholder="Stream key"
          className="w-full px-3 py-2 pr-9 rounded-lg text-xs"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        />
        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2"
          style={{ color: "var(--color-text-muted)" }}
          tabIndex={-1}
        >
          {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <button
        onClick={() => onToggle(rtmpUrl, streamKey)}
        disabled={loading || (!isActive && !streamKey)}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-semibold transition-all"
        style={
          isActive
            ? {
                background: "rgba(248,113,113,0.15)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "var(--color-destructive)",
              }
            : { background: "var(--color-primary)", color: "#000" }
        }
      >
        {loading && <Loader2 size={13} className="animate-spin" />}
        {isActive ? "Detener" : "Iniciar transmisión"}
      </button>
    </div>
  );
}
