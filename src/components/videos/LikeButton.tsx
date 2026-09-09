"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";

interface LikeButtonProps {
  videoId: string;
  currentUserId: string | null;
  initialLiked: boolean;
  initialCount: number;
}

/**
 * Dar/quitar like: inserta o borra la propia fila en video_likes — el
 * conteo en videos.likes_count lo mantiene un trigger en la base de datos
 * (migración 0031), así que este componente nunca calcula ni manda el
 * número, solo lo actualiza optimistamente en pantalla.
 *
 * createFreshClient(), no el singleton: mismo motivo que OpinionForm.tsx —
 * es un flujo de un solo uso, y el singleton puede quedarse colgado para
 * siempre si su refresh inicial de token nunca resolvió.
 */
export function LikeButton({ videoId, currentUserId, initialLiked, initialCount }: LikeButtonProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function toggleLike() {
    if (!currentUserId || pending) return;

    // Optimista: se revierte si el request falla.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    setPending(true);

    const supabase = createFreshClient();
    const { error } = nextLiked
      ? await supabase.from("video_likes").insert({ video_id: videoId, user_id: currentUserId })
      : await supabase.from("video_likes").delete().eq("video_id", videoId).eq("user_id", currentUserId);

    setPending(false);

    if (error) {
      setLiked(!nextLiked);
      setCount((c) => c + (nextLiked ? -1 : 1));
      return;
    }

    router.refresh();
  }

  if (!currentUserId) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs"
        style={{ color: "var(--color-text-muted)" }}
        title="Inicia sesión para dar like"
      >
        <Heart size={14} />
        <span>{count.toLocaleString()}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLike}
      disabled={pending}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
      style={{
        background: liked ? "rgba(248,113,113,0.12)" : "var(--color-surface-elevated)",
        border: `1px solid ${liked ? "rgba(248,113,113,0.35)" : "var(--color-border)"}`,
        color: liked ? "var(--color-destructive)" : "var(--color-text-muted)",
        opacity: pending ? 0.7 : 1,
      }}
    >
      <Heart size={15} fill={liked ? "currentColor" : "none"} />
      <span>{count.toLocaleString()}</span>
    </button>
  );
}
