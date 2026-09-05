"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Opinion } from "@/types";

export function OpinionCard({ opinion, isAdmin }: { opinion: Opinion; isAdmin: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const nombre = opinion.profiles?.display_name ?? "Alguien";
  const inicial = nombre[0]?.toUpperCase() ?? "?";

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/admin/opiniones/${opinion.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-4 flex gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {opinion.profiles?.avatar_url ? (
        <img
          src={opinion.profiles.avatar_url}
          alt={nombre}
          className="w-9 h-9 rounded-full object-cover shrink-0"
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
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
              {formatDate(opinion.created_at)}
            </span>
          </div>

          {isAdmin && (
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
                title="Borrar opinión"
                aria-label="Borrar opinión"
                className="p-1.5 rounded-lg shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Trash2 size={14} />
              </button>
            )
          )}
        </div>

        <p className="text-sm mt-1 whitespace-pre-wrap break-words" style={{ color: "var(--color-text)" }}>
          {opinion.mensaje}
        </p>
      </div>
    </div>
  );
}
