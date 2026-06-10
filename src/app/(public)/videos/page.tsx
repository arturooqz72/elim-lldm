import { createClient } from "@/lib/supabase/server";
import { VideoCard } from "@/components/videos/VideoCard";
import { Video as VideoIcon, Search, Tag, Upload } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Videos — Elim LLDM",
  description:
    "Videos compartidos por la comunidad Elim LLDM: predicaciones, pláticas, cantos, testimonios y más.",
};

interface SearchParams {
  q?: string;
  categoria?: string;
  tag?: string;
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, categoria, tag } = await searchParams;
  const supabase = await createClient();

  // Load categories for filter
  const { data: categories } = await supabase
    .from("video_categories")
    .select("id, name, slug, icon")
    .order("order_index");

  // Build videos query
  let query = supabase
    .from("videos")
    .select(
      "id, title, description, thumbnail_url, duration_seconds, view_count, published_at, tags, video_categories(id, name, slug)"
    )
    .eq("status", "approved")
    .order("published_at", { ascending: false });

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }
  if (categoria) {
    const { data: cat } = await supabase
      .from("video_categories")
      .select("id")
      .eq("slug", categoria)
      .single();
    if (cat) query = query.eq("category_id", (cat as { id: string }).id);
  }
  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data: items } = await query.limit(40);

  const activeCategory = categoria
    ? (categories ?? []).find((c: { slug: string }) => c.slug === categoria)
    : null;

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      {/* Header */}
      <div
        className="py-12 px-4"
        style={{
          background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
              Videos
            </h1>
            <p style={{ color: "var(--color-text-muted)" }}>
              Videos compartidos por la comunidad Elim LLDM
            </p>
          </div>
          <Link
            href="/videos/subir"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 w-fit"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Upload size={15} />
            Subir video
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Search + filters */}
        <form method="GET" className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar videos..."
              className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>
          <select
            name="categoria"
            defaultValue={categoria ?? ""}
            className="rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              minWidth: "180px",
            }}
          >
            <option value="">Todas las categorías</option>
            {(categories ?? []).map((c: { id: string; name: string; slug: string }) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-5 py-3 rounded-xl text-sm font-semibold shrink-0"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            Buscar
          </button>
          {(q || categoria || tag) && (
            <Link
              href="/videos"
              className="px-4 py-3 rounded-xl text-sm font-medium shrink-0 flex items-center"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              Limpiar
            </Link>
          )}
        </form>

        {/* Category pills */}
        {(categories ?? []).length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            <Link
              href="/videos"
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: !categoria ? "var(--color-primary)" : "var(--color-surface)",
                color: !categoria ? "#000" : "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              Todas
            </Link>
            {(categories as Array<{ id: string; name: string; slug: string }>).map((c) => (
              <Link
                key={c.id}
                href={`/videos?categoria=${c.slug}`}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background:
                    activeCategory && (activeCategory as { id: string }).id === c.id
                      ? "var(--color-primary)"
                      : "var(--color-surface)",
                  color:
                    activeCategory && (activeCategory as { id: string }).id === c.id
                      ? "#000"
                      : "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        {/* Active tag filter */}
        {tag && (
          <div className="flex items-center gap-2 mb-6">
            <Tag size={13} style={{ color: "var(--color-primary)" }} />
            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Filtrando por etiqueta:
            </span>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
            >
              {tag}
            </span>
            <Link href="/videos" className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              × quitar
            </Link>
          </div>
        )}

        {/* Results count */}
        {(q || categoria || tag) && (
          <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
            {items?.length ?? 0} resultado{(items?.length ?? 0) !== 1 ? "s" : ""}
            {q && (
              <>
                {" "}
                para &quot;<span style={{ color: "var(--color-text)" }}>{q}</span>&quot;
              </>
            )}
          </p>
        )}

        {/* Grid */}
        {!items || items.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-2xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <VideoIcon size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
            <p style={{ color: "var(--color-text-muted)" }}>
              {q || categoria || tag
                ? "No se encontraron videos con esos filtros"
                : "Aún no hay videos publicados"}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(
              items as unknown as Array<{
                id: string;
                title: string;
                description: string | null;
                thumbnail_url: string | null;
                duration_seconds: number | null;
                view_count: number;
                tags: string[];
                video_categories: { id: string; name: string; slug: string } | null;
              }>
            ).map((item) => (
              <VideoCard key={item.id} item={item} activeTag={tag} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
