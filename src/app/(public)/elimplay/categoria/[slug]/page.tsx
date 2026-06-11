import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Music } from "lucide-react";
import { ArtistAccordion } from "@/components/elimplay/ArtistAccordion";
import { PlayAllButton } from "@/components/elimplay/PlayAllButton";
import type { Metadata } from "next";
import type { AudioCategory, AudioTrack } from "@/types";

function groupTracksByArtist(tracks: AudioTrack[]) {
  const order: string[] = [];
  const byArtist = new Map<string, AudioTrack[]>();
  const ungrouped: AudioTrack[] = [];

  for (const track of tracks) {
    const artist = track.artist?.trim();
    if (!artist) {
      ungrouped.push(track);
      continue;
    }
    if (!byArtist.has(artist)) {
      byArtist.set(artist, []);
      order.push(artist);
    }
    byArtist.get(artist)!.push(track);
  }

  order.sort((a, b) => a.localeCompare(b, "es"));
  return {
    artistGroups: order.map((name) => ({ name, tracks: byArtist.get(name)! })),
    ungrouped,
  };
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("audio_categories")
    .select("name, description")
    .eq("slug", slug)
    .single();

  const cat = category as { name: string; description: string | null } | null;
  return {
    title: cat ? `${cat.name} — ElimPlay` : "ElimPlay",
    description: cat?.description ?? "Cantos, coros, temas y testimonios en audio.",
  };
}

export default async function ElimPlayCategoryPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("audio_categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!category) notFound();

  const cat = category as AudioCategory;

  const { data: items } = await supabase
    .from("audio_tracks")
    .select("*")
    .eq("is_published", true)
    .eq("category_id", cat.id)
    .order("created_at", { ascending: false });

  const tracks = (items ?? []) as AudioTrack[];
  const { artistGroups, ungrouped } = groupTracksByArtist(tracks);

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div
        className="py-12 px-4"
        style={{
          background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-3xl mx-auto">
          <Link
            href="/elimplay"
            className="flex items-center gap-1.5 text-sm mb-4 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft size={14} />
            ElimPlay
          </Link>

          <h1
            className="text-4xl font-bold mb-2 flex items-center gap-2"
            style={{ color: "var(--color-text)" }}
          >
            {cat.icon && <span>{cat.icon}</span>}
            {cat.name}
          </h1>
          {cat.description && (
            <p className="mb-6" style={{ color: "var(--color-text-muted)" }}>
              {cat.description}
            </p>
          )}

          <PlayAllButton tracks={tracks} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {tracks.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-2xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <Music size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
            <p style={{ color: "var(--color-text-muted)" }}>Aún no hay audios en esta categoría.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {artistGroups.map((group) => (
              <ArtistAccordion key={group.name} name={group.name} tracks={group.tracks} />
            ))}
            {ungrouped.length > 0 && (
              <ArtistAccordion name="Sin intérprete" tracks={ungrouped} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
