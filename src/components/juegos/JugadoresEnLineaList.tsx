"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, MessageCircle, Send, Users } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { JUEGOS_INVITACION, type ClaveJuegoInvitacion } from "@/lib/invitaciones";

type Estado = { tipo: "enviando" } | { tipo: "enviado"; push: boolean } | { tipo: "error"; mensaje: string };

// Solo para admin: el número sigue siendo visible para ellos (0073).
function whatsappHref(whatsapp: string, nombre: string) {
  const digits = whatsapp.replace(/[^\d]/g, "");
  const mensaje = `¡La Paz del Señor, ${nombre}! 👋 Te invito a jugar en Elim LLDM 🎮 Entra aquí: https://www.elimlldm.net/juegos — ¡Dios te bendiga!`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensaje)}`;
}

export function JugadoresEnLineaList({
  jugadores,
  currentUserId,
  esAdmin,
}: {
  jugadores: { id: string; user_id: string; nombre: string; whatsapp?: string | null }[];
  currentUserId: string;
  esAdmin: boolean;
}) {
  // Presencia en vivo: quién de esta lista tiene sesión abierta ahora mismo
  // en cualquier página del sitio (ver PublicHeader.tsx), no solo quién se
  // registró alguna vez para que lo inviten.
  const [enLineaIds, setEnLineaIds] = useState<Set<string>>(new Set());
  const [juego, setJuego] = useState<ClaveJuegoInvitacion>("trivia");
  const [estados, setEstados] = useState<Record<string, Estado>>({});

  useEffect(() => {
    // Cliente propio (no el singleton) — PublicHeader.tsx ya tiene un canal
    // "presence:site" suscrito con el cliente singleton; pedir el mismo
    // canal por nombre a través de ese mismo singleton devuelve la misma
    // instancia ya suscrita, y registrar un callback "presence" sobre un
    // canal ya suscrito tira un error real ("cannot add presence callbacks
    // ... after subscribe()") que rompe la carga de toda la página.
    const supabase = createFreshClient();
    const channel = supabase.channel("presence:site");
    channel
      .on("presence", { event: "sync" }, () => {
        setEnLineaIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function invitar(userId: string) {
    setEstados((e) => ({ ...e, [userId]: { tipo: "enviando" } }));
    let estado: Estado = { tipo: "error", mensaje: "No se pudo enviar. Intenta de nuevo." };
    try {
      const res = await fetch("/api/juegos/invitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, juego }),
      });
      const j = (await res.json().catch(() => ({}))) as { push?: boolean; error?: string };
      estado = res.ok ? { tipo: "enviado", push: Boolean(j.push) } : { tipo: "error", mensaje: j.error ?? estado.mensaje };
    } catch {
      // queda el error genérico
    }
    setEstados((e) => ({ ...e, [userId]: estado }));
  }

  const enLineaCount = jugadores.filter((j) => enLineaIds.has(j.user_id)).length;

  if (jugadores.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 flex flex-col items-center text-center gap-2"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <Users size={22} style={{ color: "var(--color-text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Todavía nadie se ha sumado a la lista de jugadores.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs px-1" style={{ color: "var(--color-text-muted)" }}>
        Invitar a:
        <select
          value={juego}
          onChange={(e) => setJuego(e.target.value as ClaveJuegoInvitacion)}
          className="rounded-lg px-2 py-1.5 text-xs outline-none"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        >
          {JUEGOS_INVITACION.map((j) => (
            <option key={j.clave} value={j.clave}>
              {j.nombre}
            </option>
          ))}
        </select>
      </label>
      {enLineaCount > 0 && (
        <p className="text-xs flex items-center gap-1.5 px-1" style={{ color: "var(--color-text-muted)" }}>
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-success)" }} />
          {enLineaCount} en línea ahora
        </p>
      )}
      <div
        className="rounded-2xl divide-y overflow-hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {jugadores.map((j) => {
          const online = enLineaIds.has(j.user_id);
          const estado = estados[j.user_id];
          return (
            <div key={j.id} className="flex flex-col gap-1 px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: online ? "var(--color-success)" : "var(--color-border)" }}
                    title={online ? "En línea ahora" : "Sin conexión"}
                  />
                  <p className="font-medium text-sm truncate" style={{ color: "var(--color-text)" }}>
                    {j.nombre}
                    {j.user_id === currentUserId && (
                      <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
                        (tú)
                      </span>
                    )}
                  </p>
                </div>

                {j.user_id !== currentUserId && (
                  <div className="flex items-center gap-2 shrink-0">
                    {esAdmin && j.whatsapp && (
                      <a
                        href={whatsappHref(j.whatsapp, j.nombre)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp de ${j.nombre} (solo admin)`}
                        title="WhatsApp (solo lo ven los admin)"
                        className="flex items-center justify-center w-9 h-9 rounded-xl"
                        style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.35)", color: "#25D366" }}
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => invitar(j.user_id)}
                      disabled={estado?.tipo === "enviando" || estado?.tipo === "enviado"}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-70"
                      style={{ background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.35)", color: "var(--color-primary)" }}
                    >
                      {estado?.tipo === "enviando" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : estado?.tipo === "enviado" ? (
                        <Check size={14} />
                      ) : (
                        <Send size={14} />
                      )}
                      {estado?.tipo === "enviado" ? "Invitado" : "Invitar"}
                    </button>
                  </div>
                )}
              </div>
              {estado?.tipo === "enviado" && (
                <p className="text-xs pl-4" style={{ color: "var(--color-text-muted)" }}>
                  {estado.push || online
                    ? "Le llegó tu invitación."
                    : "Ahora no tiene el sitio abierto ni las notificaciones activadas, así que no le llegará por el momento."}
                </p>
              )}
              {estado?.tipo === "error" && (
                <p className="text-xs pl-4" style={{ color: "var(--color-destructive)" }}>
                  {estado.mensaje}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
