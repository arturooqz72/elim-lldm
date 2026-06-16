"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useLivePlatika, type LivePlatika } from "@/lib/hooks/useLivePlatika";

interface LiveBannerProps {
  initial: LivePlatika | null;
}

export function LiveBanner({ initial }: LiveBannerProps) {
  const live = useLivePlatika(initial);

  if (!live) return null;

  return (
    <section className="px-4 pb-4">
      <div className="max-w-5xl mx-auto">
        <div
          className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3"
          style={{
            background: "rgba(255,68,68,0.06)",
            border: "1px solid rgba(255,68,68,0.2)",
          }}
        >
          <span
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0"
            style={{ background: "var(--color-live)", color: "#fff" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            EN VIVO AHORA
          </span>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-live)" }}
            >
              Estudio en Vivo – Elim
            </span>
            <Link
              href={`/platikas/${live.id}`}
              className="text-sm font-medium hover:underline truncate"
              style={{ color: "var(--color-text)" }}
            >
              {live.title}
            </Link>
          </div>
          <Link
            href={`/platikas/${live.id}`}
            className="shrink-0 flex items-center gap-1 text-sm font-semibold"
            style={{ color: "var(--color-live)" }}
          >
            Unirse <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
