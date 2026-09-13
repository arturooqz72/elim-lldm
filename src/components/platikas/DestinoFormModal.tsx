"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import { DESTINO_ESTILOS } from "@/lib/platikas/destino-estilos";
import type { DestinoConEstado, DestinoPlataforma } from "@/types";

interface DestinoFormModalProps {
  destino: DestinoConEstado | null; // null = crear nuevo
  onClose: () => void;
  onSaved: () => void;
}

const PLATAFORMAS: DestinoPlataforma[] = ["youtube", "facebook", "tiktok", "otro"];

export function DestinoFormModal({ destino, onClose, onSaved }: DestinoFormModalProps) {
  const [nombre, setNombre] = useState(destino?.nombre ?? "");
  const [plataforma, setPlataforma] = useState<DestinoPlataforma>(destino?.plataforma ?? "youtube");
  const [rtmpUrl, setRtmpUrl] = useState(destino?.rtmp_url ?? "");
  const [streamKey, setStreamKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!destino;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !rtmpUrl.trim() || (!isEditing && !streamKey.trim())) {
      setError("Nombre, URL RTMP y stream key son requeridos");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const url = isEditing ? `/api/destinos/${destino!.id}` : "/api/destinos";
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          plataforma,
          rtmp_url: rtmpUrl.trim(),
          ...(streamKey.trim() ? { stream_key: streamKey.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al guardar el destino");
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
            {isEditing ? "Editar destino" : "Agregar destino"}
          </h3>
          <button onClick={onClose} style={{ color: "var(--color-text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder='Ej: "YouTube Iglesia Central"'
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Plataforma
            </label>
            <select
              value={plataforma}
              onChange={(e) => setPlataforma(e.target.value as DestinoPlataforma)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              {PLATAFORMAS.map((p) => (
                <option key={p} value={p}>
                  {DESTINO_ESTILOS[p].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
              URL RTMP
            </label>
            <input
              type="text"
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              placeholder="rtmp://a.rtmp.youtube.com/live2"
              className="w-full px-3 py-2 rounded-lg text-xs"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Stream key {isEditing && "(déjalo vacío para no cambiarlo)"}
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                placeholder={isEditing ? "••••••••" : "Stream key"}
                className="w-full px-3 py-2 pr-9 rounded-lg text-xs"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
                tabIndex={-1}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isEditing ? "Guardar cambios" : "Agregar destino"}
          </button>
        </form>
      </div>
    </div>
  );
}
