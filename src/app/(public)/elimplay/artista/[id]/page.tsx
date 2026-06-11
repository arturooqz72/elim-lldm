import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Music } from "lucide-react";
import { TrackRow } from "@/components/elimplay/TrackRow";
import { PlayAllButton } from "@/components/elimplay/PlayAllButton";
import { ShuffleButton } from "@/components/elimplay/ShuffleButton";
import type { Metadata } from "next";
import type { Artist, AudioTrack } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: artist } = await supabase.from("artists").select("name").eq("id", id).single();

  const a = artist as { name: string } | null;
  return {
    title: a ? `${a.name} — ElimPlay` : "ElimPlay",
    description: a ? `Escucha todos los audios de ${a.name} en ElimPlay.` : undefined,
  };
}

export default async function ElimPlayArtistPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: artist } = await supabase.from("artists").select("*").eq("id", id).single();
  if (!artist) notFound();
  const a = artist as Artist;

  const { data: items } = await supabase
    .from("audio_tracks")
    .select("*, artists(id, name, photo_url), audio_categories(name)")
    .eq("is_published", true)
    .eq("artist_id", id)
    .order("created_at", { ascending: false });

  const tracks = (items ?? []) as (AudioTrack & { audio_categories: { name: string } | null })[];

  const categoryNames = Array.from(
    new Set(tracks.map((t) => t.audio_categories?.name).filter((n): n is string => !!n))
  );

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div
        className="py-12 px-4"
        style={{
          background: "linear-gradient(to bottom, rgba(212,160,23,0.1) 0%, transparent 100%)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-6xl mx-auto">
          <Link
            href="/elimplay"
            className="flex items-center gap-1.5 text-sm mb-6 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft size={14} />
            ElimPlay
          </Link>

          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
            <div
              className="w-40 h-40 sm:w-52 sm:h-52 rounded-full overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
            >
              {a.photo_url ? (
                <img src={a.photo_url} alt={a.name} className="w-full h-full object-cover" />
              ) : (
                <Music size={56} style={{ color: "var(--color-primary)" }} />
              )}
            </div>

            <div className="text-center sm:text-left min-w-0">
              <h1
                className="text-3xl sm:text-5xl font-bold mb-2 truncate"
                style={{ color: "var(--color-text)" }}
              >
                {a.name}
              </h1>
              <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
                {categoryNames.length > 0 && `${categoryNames.join(" · ")} · `}
                {tracks.length} canto{tracks.length === 1 ? "" : "s"}
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-3">
                <PlayAllButton tracks={tracks} />
                <ShuffleButton tracks={tracks} size={18} className="w-12 h-12" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {tracks.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-2xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <Music size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
            <p style={{ color: "var(--color-text-muted)" }}>Este artista aún no tiene audios.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {tracks.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i + 1} queue={tracks} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
