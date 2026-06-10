import { createClient } from "@/lib/supabase/server";
import { TrackCard } from "@/components/elimplay/TrackCard";
import { Music, Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import type { AudioCategory, AudioTrack } from "@/types";

export const metadata: Metadata = {
  title: "ElimPlay — Elim LLDM",
  description: "Cantos, coros, temas y testimonios en audio — escucha cuando quieras.",
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
    const { data: results } = await supabase
      .from("audio_tracks")
      .select("*")
      .eq("is_published", true)
      .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(40);

    const tracks = (results ?? []) as AudioTrack[];

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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {tracks.map((track) => (
                <TrackCard key={track.id} track={track} queue={tracks} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Browse mode — one section per category
  const sections = await Promise.all(
    cats.map(async (cat) => {
      const { data } = await supabase
        .from("audio_tracks")
        .select("*")
        .eq("is_published", true)
        .eq("category_id", cat.id)
        .order("created_at", { ascending: false })
        .limit(8);
      return { category: cat, tracks: (data ?? []) as AudioTrack[] };
    })
  );

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <ElimPlayHeader />
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-10">
        {sections.length === 0 ? (
          <EmptyState text="Aún no hay categorías de audio configuradas" />
        ) : (
          sections.map(({ category, tracks }) => (
            <section key={category.id}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--color-text)" }}>
                  {category.icon && <span>{category.icon}</span>}
                  {category.name}
                </h2>
                <Link
                  href={`/elimplay/categoria/${category.slug}`}
                  className="text-sm font-medium"
                  style={{ color: "var(--color-primary)" }}
                >
                  Ver todo →
                </Link>
              </div>

              {tracks.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Aún no hay audios en esta categoría.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {tracks.map((track) => (
                    <TrackCard key={track.id} track={track} queue={tracks} />
                  ))}
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
          Cantos, coros, temas y testimonios — escucha cuando quieras
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
            placeholder="Buscar cantos, coros, temas..."
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
