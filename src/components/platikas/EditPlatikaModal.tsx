"use client";

import { useState } from "react";
import { Loader2, Pencil, X } from "lucide-react";

interface EditPlatikaModalProps {
  platika: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    scheduled_at: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
}

export function EditPlatikaModal({ platika, onClose, onSaved }: EditPlatikaModalProps) {
  const [title, setTitle] = useState(platika.title);
  const [description, setDescription] = useState(platika.description ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    platika.scheduled_at ? new Date(platika.scheduled_at).toISOString().slice(0, 16) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
    };
    if (platika.status === "scheduled") {
      body.scheduled_at = scheduledAt || null;
    }

    try {
      const res = await fetch(`/api/platikas/${platika.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al guardar los cambios");
        setLoading(false);
        return;
      }

      onSaved();
    } catch {
      setError("Error al guardar los cambios");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(10,10,18,0.7)" }}
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--color-text)" }}>
            <Pencil size={16} style={{ color: "var(--color-primary)" }} />
            Editar sesión
          </h2>
          <button onClick={onClose} disabled={loading} style={{ color: "var(--color-text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              autoFocus
              disabled={loading}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={loading}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          {platika.status === "scheduled" && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Fecha programada
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>
          )}

          {error && (
            <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Guardar cambios
          </button>
        </form>
      </div>
    </div>
  );
}
