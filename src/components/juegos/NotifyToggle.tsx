"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { getNotificationPermission, isPushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push/subscribe";

/**
 * Activa/desactiva notificaciones push de "alguien se conectó, listo para
 * jugar" — ver /api/juegos/jugadores/notify-online. Solo tiene sentido
 * para alguien YA en la lista (por eso vive dentro del bloque "registrado"
 * de la página, no visible para quien todavía no se apuntó).
 */
export function NotifyToggle() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isPushSupported());
    setEnabled(getNotificationPermission() === "granted");
  }, []);

  async function handleToggle() {
    setLoading(true);
    setError(null);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
      } else {
        await subscribeToPush();
        setEnabled(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la notificación.");
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
        style={{
          background: enabled ? "rgba(212,160,23,0.12)" : "var(--color-surface-elevated)",
          border: `1px solid ${enabled ? "rgba(212,160,23,0.35)" : "var(--color-border)"}`,
          color: enabled ? "var(--color-primary)" : "var(--color-text-muted)",
        }}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : enabled ? (
          <Bell size={15} />
        ) : (
          <BellOff size={15} />
        )}
        {enabled ? "Avisos activados — te llega cuando alguien se conecta" : "Avísame cuando alguien se conecte"}
      </button>
      {error && (
        <p className="text-xs text-center" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
