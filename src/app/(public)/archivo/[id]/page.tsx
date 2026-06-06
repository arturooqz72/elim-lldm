import { createClient, createServiceClient } from "@/lib/supabase/server";
import { VideoPlayer } from "@/components/archivo/VideoPlayer";
import { formatDate, formatDuration } from "@/lib/utils";
import { Archive, ArrowLeft, Eye, Tag, Calendar } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("archive")
    .select("title, description")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!data) return { title: "Archivo — Elim LLDM" };

  return {
    title: `${(data as { title: string }).title} — Archivo Elim LLDM`,
    description: (data as { description: string | null }).description ?? undefined,
  };
}

export default async function ArchivoDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("archive")
    .select("*, categories(id, name, slug)")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!item) notFound();

  const record = item as unknown as {
    id: string;
    title: string;
    description: string | null;
    recording_url: string;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    view_count: number;
    published_at: string | null;
    tags: string[];
    categories: { id: string; name: string; slug: string } | null;
  };

  // Increment view count in the background (not awaited to avoid blocking render)
  const serviceClient = await createServiceClient();
  void serviceClient.rpc("increment_view_count", { record_id: id });

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/archivo"
          className="inline-flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-80"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={14} />
          Volver al archivo
        </Link>

        {/* Video player */}
        <VideoPlayer
          src={record.recording_url}
          thumbnail={record.thumbnail_url}
          title={record.title}
        />

        {/* Metadata */}
        <div className="mt-6 flex flex-col gap-4">
          {/* Category + title */}
          {record.categories && (
            <Link
              href={`/archivo?categoria=${record.categories.slug}`}
              className="text-xs font-medium transition-opacity hover:opacity-80 w-fit"
              style={{ color: "var(--color-primary)" }}
            >
              {record.categories.name}
            </Link>
          )}

          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            {record.title}
          </h1>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4">
            {record.published_at && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <Calendar size={12} />
                <span>{formatDate(record.published_at)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <Eye size={12} />
              <span>{(record.view_count + 1).toLocaleString()} reproducciones</span>
            </div>
            {record.duration_seconds != null && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <Archive size={12} />
                <span>{formatDuration(record.duration_seconds)}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {record.description && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              {record.description}
            </p>
          )}

          {/* Tags */}
          {record.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Tag size={13} className="mt-0.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
              {record.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/archivo?tag=${encodeURIComponent(tag)}`}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80"
                  style={{
                    background: "rgba(212,160,23,0.1)",
                    border: "1px solid rgba(212,160,23,0.2)",
                    color: "var(--color-primary)",
                  }}
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          className="mt-10 pt-8"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
            Contenido del archivo de la Iglesia La Luz del Mundo — Elim LLDM
          </p>
        </div>
      </div>
    </div>
  );
}
