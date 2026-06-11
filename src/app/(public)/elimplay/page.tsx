import { createClient } from "@/lib/supabase/server";
import { TrackRow } from "@/components/elimplay/TrackRow";
import { ArtistAccordion } from "@/components/elimplay/ArtistAccordion";
import { ArtistCard } from "@/components/elimplay/ArtistCard";
import { groupTracksByArtist } from "@/lib/elimplay";
import { Music, Search } from "lucide-react";
import type { Metadata } from "next";
import type { AudioCategory, AudioTrack } from "@/types";

export const metadata: Metadata = {
  title: "ElimPlay — Elim LLDM",
  description: "Cantos, predicaciones, temas y testimonios en audio — escucha cuando quieras.",
};

interface SearchParams {
  q?: string;
}

export default async function ElimPlayPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("audio_categories")
    .select("id, name, slug, description, icon")
    .order("order_index");

  const cats = (categories ?? []) as AudioCategory[];

  // Search mode
  if (q) {
    const [{ data: titleMatches }, { data: artistMatches }] = await Promise.all([
      supabase
        .from("audio_tracks")
        .select("*, artists(id, name, photo_url)")
        .eq("is_published", true)
        .ilike("title", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("audio_tracks")
        .select("*, artists!inner(id, name, photo_url)")
        .eq("is_published", true)
        .ilike("artists.name", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const merged = new Map<string, AudioTrack>();
    for (const t of [...(titleMatches ?? []), ...(artistMatches ?? [])] as AudioTrack[]) {
      merged.set(t.id, t);
    }
    const tracks = Array.from(merged.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 40);

    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <ElimPlayHeader q={q} />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
            {tracks.length} resultado{tracks.length !== 1 ? "s" : ""} para &quot;
            <span style={{ color: "var(--color-text)" }}>{q}</span>&quot;
          </p>

          {tracks.length === 0 ? (
            <EmptyState text="No se encontraron audios con ese nombre" />
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

  // Browse mode — one section per category, with artist cards
  const sections = await Promise.all(
    cats.map(async (cat) => {
      const { data } = await supabase
        .from("audio_tracks")
        .select("*, artists(id, name, photo_url)")
        .eq("is_published", true)
        .eq("category_id", cat.id)
        .order("created_at", { ascending: false });
      const tracks = (data ?? []) as AudioTrack[];
      return { category: cat, ...groupTracksByArtist(tracks) };
    })
  );

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <ElimPlayHeader />
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-10">
        {sections.length === 0 ? (
          <EmptyState text="Aún no hay categorías de audio configuradas" />
        ) : (
          sections.map(({ category, artistGroups, ungrouped }) => (
            <section key={category.id}>
              <h2
                className="text-xl font-bold flex items-center gap-2 mb-4"
                style={{ color: "var(--color-text)" }}
              >
                {category.icon && <span>{category.icon}</span>}
                {category.name}
              </h2>

              {artistGroups.length === 0 && ungrouped.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Aún no hay audios en esta categoría.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {artistGroups.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {artistGroups.map(({ artist, tracks }) => (
                        <ArtistCard key={artist.id} artist={artist} count={tracks.length} />
                      ))}
                    </div>
                  )}
                  {ungrouped.length > 0 && (
                    <ArtistAccordion name="Sin intérprete" tracks={ungrouped} />
                  )}
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function ElimPlayHeader({ q }: { q?: string }) {
  return (
    <div
      className="py-12 px-4"
      style={{
        background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <h1
          className="text-4xl font-bold mb-2 flex items-center gap-2"
          style={{ color: "var(--color-text)" }}
        >
          <Music size={32} style={{ color: "var(--color-primary)" }} />
          ElimPlay
        </h1>
        <p className="mb-6" style={{ color: "var(--color-text-muted)" }}>
          Cantos, predicaciones, temas y testimonios — escucha cuando quieras
        </p>

        <form method="GET" className="relative max-w-md">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar cantos, artistas, temas..."
            className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </form>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded-2xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <Music size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
      <p style={{ color: "var(--color-text-muted)" }}>{text}</p>
    </div>
  );
}
