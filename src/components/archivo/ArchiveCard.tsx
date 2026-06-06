"use client";

import Link from "next/link";
import { Play, Eye } from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface ArchiveItem {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  tags: string[];
  categories: { id: string; name: string; slug: string } | null;
}

export function ArchiveCard({
  item,
  activeTag,
}: {
  item: ArchiveItem;
  activeTag?: string;
}) {
  return (
    <Link
      href={`/archivo/${item.id}`}
      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 group"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,160,23,0.35)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-video flex items-center justify-center overflow-hidden"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(212,160,23,0.1)" }}
          >
            <Play size={22} style={{ color: "var(--color-primary)" }} />
          </div>
        )}
        {/* Play overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(10,10,18,0.5)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Play size={18} fill="currentColor" />
          </div>
        </div>
        {/* Duration badge */}
        {item.duration_seconds != null && (
          <span
            className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-xs font-mono font-medium"
            style={{ background: "rgba(10,10,18,0.75)", color: "var(--color-text)" }}
          >
            {formatDuration(item.duration_seconds)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {item.categories && (
          <span className="text-xs font-medium" style={{ color: "var(--color-primary)" }}>
            {item.categories.name}
          </span>
        )}

        <h3
          className="text-sm font-semibold line-clamp-2 leading-snug"
          style={{ color: "var(--color-text)" }}
        >
          {item.title}
        </h3>

        {item.description && (
          <p className="text-xs line-clamp-2" style={{ color: "var(--color-text-muted)" }}>
            {item.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <Eye size={11} />
            <span>{item.view_count.toLocaleString()}</span>
          </div>

          {item.tags?.length > 0 && (
            <div className="flex gap-1 flex-wrap justify-end">
              {item.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    background:
                      t === activeTag
                        ? "rgba(212,160,23,0.2)"
                        : "var(--color-surface-elevated)",
                    color:
                      t === activeTag ? "var(--color-primary)" : "var(--color-text-muted)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
