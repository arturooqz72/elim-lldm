"use client";

import { useEffect, useState } from "react";
import { Circle } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";

interface JuegosPresenceProps {
  // null si el visitante no inició sesión — igual puede VER quién está en
  // línea, solo que no se suma él mismo a la lista (no tiene nombre que
  // mostrar).
  currentUser: { id: string; nombre: string } | null;
}

/**
 * "N en línea ahora en Juegos" — canal de presencia propio para esta
 * página (`presence:juegos`), distinto del `presence:site` global que ya
 * usa PublicHeader.tsx para todo el sitio. La diferencia importa: alguien
 * escuchando la radio en otra pestaña no debería aparecer aquí como
 * "disponible para jugar" — solo cuenta quien tiene ESTA página abierta
 * en este momento.
 *
 * Señal complementaria a GameNotifyBell: el aviso por juego solo dispara
 * cuando alguien ya se sentó a esperar en una sala; esto deja ver "hay
 * alguien mirando ahora mismo" ANTES de que nadie se comprometa a nada,
 * para que dos personas se pongan de acuerdo y entren juntas.
 */
export function JuegosPresence({ currentUser }: JuegosPresenceProps) {
  const [enLinea, setEnLinea] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    const supabase = createFreshClient();
    const channel = supabase.channel("presence:juegos", {
      config: { presence: { key: currentUser?.id ?? crypto.randomUUID() } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ nombre: string }>();
        const lista = Object.values(state)
          .map((presences) => presences[0])
          .filter((p): p is { nombre: string } & { presence_ref: string } => !!p?.nombre)
          .map((p, i) => ({ id: `${i}`, nombre: p.nombre }));
        setEnLinea(lista);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && currentUser) {
          channel.track({ nombre: currentUser.nombre });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  if (enLinea.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs px-1" style={{ color: "var(--color-text-muted)" }}>
        <Circle size={7} style={{ color: "var(--color-text-muted)" }} fill="currentColor" />
        Nadie viendo Juegos ahora mismo
      </p>
    );
  }

  const nombres = enLinea.map((p) => p.nombre);
  const resumen =
    nombres.length <= 2
      ? nombres.join(" y ")
      : `${nombres.slice(0, 2).join(", ")} y ${nombres.length - 2} más`;

  return (
    <p className="flex items-center gap-1.5 text-xs px-1" style={{ color: "var(--color-text-muted)" }}>
      <Circle size={7} style={{ color: "var(--color-success)" }} fill="currentColor" />
      <span style={{ color: "var(--color-text)" }}>
        {enLinea.length} en línea ahora
      </span>
      — {resumen}
    </p>
  );
}
