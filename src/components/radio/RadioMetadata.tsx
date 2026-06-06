import type { NowPlayingData } from "@/lib/azuracast/api";
import { Users, Music } from "lucide-react";

interface RadioMetadataProps {
  data: NowPlayingData | null;
}

export function RadioMetadata({ data }: RadioMetadataProps) {
  if (!data) {
    return (
      <div
        className="rounded-2xl p-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>
          Cargando información del stream...
        </p>
      </div>
    );
  }

  const { now_playing, listeners } = data;

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <h3
        className="text-sm font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        En este momento
      </h3>

      <div className="flex items-center gap-4">
        {now_playing.song.art ? (
          <img
            src={now_playing.song.art}
            alt="Album art"
            className="w-16 h-16 rounded-xl object-cover"
            style={{ border: "1px solid var(--color-border)" }}
          />
        ) : (
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
          >
            <Music size={24} style={{ color: "var(--color-primary)" }} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p
            className="font-semibold truncate"
            style={{ color: "var(--color-text)", fontSize: "16px" }}
          >
            {now_playing.song.title || "Transmisión en vivo"}
          </p>
          {now_playing.song.artist && (
            <p
              className="truncate"
              style={{ color: "var(--color-text-muted)", fontSize: "13px" }}
            >
              {now_playing.song.artist}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
        <Users size={14} />
        <span>{listeners.current} oyentes ahora</span>
      </div>
    </div>
  );
}
