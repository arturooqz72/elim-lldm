"use client";

import Link from "next/link";
import { useLivePlatika } from "@/lib/hooks/useLivePlatika";

interface LiveBadgeProps {
  className?: string;
}

export function LiveBadge({ className }: LiveBadgeProps) {
  const live = useLivePlatika();

  if (!live) return null;

  return (
    <Link
      href={`/platikas/${live.id}`}
      title={live.title}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold animate-pulse ${className ?? ""}`}
      style={{ background: "var(--color-live)", color: "#fff" }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
      EN VIVO
    </Link>
  );
}
