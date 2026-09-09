"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Users } from "lucide-react";
import { isPushSupported, subscribeToPush } from "@/lib/push/subscribe";

interface GameNotifyBellProps {
  gameKey: "arena_abierta" | "ruleta";
  esperando: number;
  initialSubscribed: boolean;
}

/**
 * Campana de "avísame cuando alguien quiera jugar ESTE juego" — vive
 * directo en la puerta del hub, no en una página aparte. Reemplaza a
 * NotifyToggle.tsx (aviso genérico de "alguien se conectó al sitio").
 *
 * Al activar: se suscribe al push del navegador si hace falta (mismo
 * subscribeToPush() de siempre — una sola suscripción de navegador sirve
 * para avisos de cualquier juego) y guarda la preferencia de ESTE juego en
 * game_notify_subscriptions. Al desactivar: solo borra esa preferencia —
 * no toca la suscripción del navegador, por si sigue activa para otro
 * juego.
 */
export function GameNotifyBell({ gameKey, esperando, initialSubscribed }: GameNotifyBellProps) {
  // false en el primer render a propósito, igual del lado del servidor que
  // en el primer render del cliente (isPushSupported() mira `window`, que
  // no existe durante el render de servidor) — calcularlo de una vez con
  // useState(isPushSupported) desincroniza ese primer render y React tira
  // un hydration mismatch. Se corrige después del montaje, en el useEffect.
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isPushSupported());
  }, []);

  async function handleToggle() {
    setLoading(true);
    setError(null);
    try {
      if (subscribed) {
        const res = await fetch(`/api/juegos/${gameKey}/notify-subscribe`, { method: "DELETE" });
        if (!res.ok) throw new Error("No se pudo desactivar el aviso.");
        setSubscribed(false);
      } else {
        await subscribeToPush();
        const res = await fetch(`/api/juegos/${gameKey}/notify-subscribe`, { method: "POST" });
        if (!res.ok) throw new Error("No se pudo guardar la preferencia.");
        setSubscribed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el aviso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {esperando > 0 && (
          <span
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg shrink-0"
            style={{ background: "rgba(212,160,23,0.12)", color: "var(--color-primary)" }}
          >
            <Users size={12} />
            {esperando} esperando
          </span>
        )}

        {supported && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: subscribed ? "rgba(212,160,23,0.12)" : "var(--color-surface-elevated)",
              border: `1px solid ${subscribed ? "rgba(212,160,23,0.35)" : "var(--color-border)"}`,
              color: subscribed ? "var(--color-primary)" : "var(--color-text-muted)",
            }}
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : subscribed ? (
              <Bell size={12} />
            ) : (
              <BellOff size={12} />
            )}
            {subscribed ? "Te avisamos" : "Avísame"}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
