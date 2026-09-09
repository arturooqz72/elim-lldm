"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface VideoComment {
  id: string;
  mensaje: string;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

export function VideoCommentCard({ comment, canModerate }: { comment: VideoComment; canModerate: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const nombre = comment.profiles?.display_name ?? "Alguien";
  const inicial = nombre[0]?.toUpperCase() ?? "?";

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/admin/video-comments/${comment.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex gap-3 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
      {comment.profiles?.avatar_url ? (
        <img
          src={comment.profiles.avatar_url}
          alt={nombre}
          className="w-8 h-8 rounded-full object-cover shrink-0"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          {inicial}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
              {nombre}
            </span>
            <span className="text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>
              {formatDate(comment.created_at)}
            </span>
          </div>

          {canModerate && (
            confirming ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--color-destructive)", color: "#1a0000" }}
                >
                  {deleting ? "Borrando…" : "Confirmar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                title="Borrar comentario"
                aria-label="Borrar comentario"
                className="p-1.5 rounded-lg shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Trash2 size={14} />
              </button>
            )
          )}
        </div>

        <p className="text-sm mt-1 whitespace-pre-wrap break-words" style={{ color: "var(--color-text)" }}>
          {comment.mensaje}
        </p>
      </div>
    </div>
  );
}
