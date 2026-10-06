"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gamepad2, X } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { canalInvitacion, EVENTO_INVITACION, juegoInvitacion } from "@/lib/invitaciones";

type Juego = NonNullable<ReturnType<typeof juegoInvitacion>>;

/**
 * Aviso flotante "Te invitan a jugar…" para quien tiene sesión y el sitio
 * abierto. Escucha su propio canal invitacion:<id> (lo manda
 * /api/admin/invitar desde /admin/en-linea).
 */
export function InvitacionJuego({ profileId }: { profileId: string | null }) {
  const [juego, setJuego] = useState<Juego | null>(null);

  useEffect(() => {
    if (!profileId) return;
    // Cliente propio, no el singleton (ver JugadoresEnLineaList.tsx).
    const supabase = createFreshClient();
    const canal = supabase
      .channel(canalInvitacion(profileId))
      .on("broadcast", { event: EVENTO_INVITACION }, ({ payload }) => {
        const j = juegoInvitacion((payload as { juego?: unknown } | undefined)?.juego);
        if (j) setJuego(j);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [profileId]);

  if (!juego) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Invitación a jugar"
      className="fixed z-[60] bottom-4 left-4 right-4 sm:left-auto sm:w-96 rounded-2xl p-4 flex gap-3 items-start"
      style={{
        background: "var(--color-surface-elevated)",
        border: "1px solid rgba(212,160,23,0.45)",
        boxShadow: "0 0 24px rgba(212,160,23,0.25)",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(212,160,23,0.15)" }}
      >
        <Gamepad2 size={20} style={{ color: "var(--color-primary)" }} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <p className="text-sm" style={{ color: "var(--color-text)" }}>
          <strong>¡La Paz del Señor!</strong> El equipo de Elim LLDM te invita a jugar{" "}
          <strong style={{ color: "var(--color-primary)" }}>{juego.nombre}</strong>.
        </p>
        <div className="flex gap-2">
          <Link
            href={juego.href}
            onClick={() => setJuego(null)}
            className="flex-1 text-center py-2 rounded-lg text-sm font-bold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            Ir a jugar
          </Link>
          <button
            type="button"
            onClick={() => setJuego(null)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            Ahora no
          </button>
        </div>
      </div>
      <button type="button" onClick={() => setJuego(null)} aria-label="Cerrar" style={{ color: "var(--color-text-muted)" }}>
        <X size={16} />
      </button>
    </div>
  );
}
