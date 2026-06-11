import Link from "next/link";
import { Music } from "lucide-react";
import type { Artist } from "@/types";

export function ArtistCard({ artist, count }: { artist: Artist; count: number }) {
  return (
    <Link
      href={`/elimplay/artista/${artist.id}`}
      className="flex flex-col gap-3 p-4 rounded-2xl transition-colors hover:bg-[var(--color-surface-elevated)]"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="w-full aspect-square rounded-full overflow-hidden flex items-center justify-center shrink-0"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        {artist.photo_url ? (
          <img src={artist.photo_url} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <Music size={32} style={{ color: "var(--color-primary)" }} />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
          {artist.name}
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {count} canto{count === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}
