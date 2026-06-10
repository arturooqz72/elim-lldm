import { createClient, createServiceClient } from "@/lib/supabase/server";
import { VideoPlayer } from "@/components/archivo/VideoPlayer";
import { formatDate, formatDuration } from "@/lib/utils";
import { Video as VideoIcon, ArrowLeft, Eye, Tag, Calendar, AlertTriangle, Clock } from "lucide-react";
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
    .from("videos")
    .select("title, description")
    .eq("id", id)
    .single();

  if (!data) return { title: "Videos — Elim LLDM" };

  return {
    title: `${(data as { title: string }).title} — Videos Elim LLDM`,
    description: (data as { description: string | null }).description ?? undefined,
  };
}

export default async function VideoDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("videos")
    .select("*, video_categories(id, name, slug)")
    .eq("id", id)
    .single();

  if (!item) notFound();

  const record = item as unknown as {
    id: string;
    title: string;
    description: string | null;
    video_url: string;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    view_count: number;
    status: "pending" | "approved" | "rejected";
    rejection_reason: string | null;
    published_at: string | null;
    tags: string[];
    video_categories: { id: string; name: string; slug: string } | null;
  };

  // Increment view count in the background (no-op if not approved yet)
  const serviceClient = await createServiceClient();
  void serviceClient.rpc("increment_video_view_count", { video_id: id });

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/videos"
          className="inline-flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-80"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={14} />
          Volver a Videos
        </Link>

        {/* Status banner for non-approved videos (visible to owner/admin via RLS) */}
        {record.status === "pending" && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm"
            style={{
              background: "rgba(212,160,23,0.1)",
              border: "1px solid rgba(212,160,23,0.3)",
              color: "var(--color-primary)",
            }}
          >
            <Clock size={15} className="shrink-0" />
            Este video está pendiente de aprobación. Solo tú y los administradores pueden verlo.
          </div>
        )}
        {record.status === "rejected" && (
          <div
            className="flex items-start gap-2 px-4 py-3 rounded-xl mb-6 text-sm"
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "var(--color-destructive)",
            }}
          >
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <div>
              <p>Este video fue rechazado y no es visible públicamente.</p>
              {record.rejection_reason && (
                <p className="mt-1 opacity-80">Motivo: {record.rejection_reason}</p>
              )}
            </div>
          </div>
        )}

        {/* Video player */}
        <VideoPlayer src={record.video_url} thumbnail={record.thumbnail_url} title={record.title} />

        {/* Metadata */}
        <div className="mt-6 flex flex-col gap-4">
          {/* Category + title */}
          {record.video_categories && (
            <Link
              href={`/videos?categoria=${record.video_categories.slug}`}
              className="text-xs font-medium transition-opacity hover:opacity-80 w-fit"
              style={{ color: "var(--color-primary)" }}
            >
              {record.video_categories.name}
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
              <span>
                {(record.status === "approved" ? record.view_count + 1 : record.view_count).toLocaleString()}{" "}
                reproducciones
              </span>
            </div>
            {record.duration_seconds != null && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <VideoIcon size={12} />
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
                  href={`/videos?tag=${encodeURIComponent(tag)}`}
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
        <div className="mt-10 pt-8" style={{ borderTop: "1px solid var(--color-border)" }}>
          <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
            Videos compartidos por la comunidad de la Iglesia La Luz del Mundo — Elim LLDM
          </p>
        </div>
      </div>
    </div>
  );
}
