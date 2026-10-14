"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ArenaJugador } from "@/types";

/**
 * Fotos y conexión de los jugadores de una sala de Trivia en línea.
 *
 * - Fotos: de profiles (id y avatar_url son públicos, regla 0076). Quien no
 *   tiene foto se muestra con su inicial.
 * - Conexión: Supabase Presence en un canal propio de la sala. Cada jugador
 *   que tiene la sala abierta se anuncia con su id; quien cierra la pestaña
 *   o pierde la conexión sale del estado y se muestra atenuado. Mientras no
 *   llega la primera sincronización, `conectados` es null (todos se ven
 *   normales).
 */
export function useJugadoresEnVivo(salaId: string, jugadorId: string | null, jugadores: ArenaJugador[]) {
  const [avatares, setAvatares] = useState<Record<string, string | null>>({});
  const [conectados, setConectados] = useState<Set<string> | null>(null);
  const pedidos = useRef(new Set<string>());

  // Fotos: solo de las cuentas que todavía no se han pedido.
  const userIds = jugadores.map((j) => j.user_id).filter((id): id is string => Boolean(id));
  const clave = [...new Set(userIds)].sort().join(",");
  useEffect(() => {
    const faltan = clave.split(",").filter((id) => id && !pedidos.current.has(id));
    if (faltan.length === 0) return;
    faltan.forEach((id) => pedidos.current.add(id));
    createClient()
      .from("profiles")
      .select("id, avatar_url")
      .in("id", faltan)
      .then(({ data }) => {
        if (!data) return;
        setAvatares((prev) => {
          const sig = { ...prev };
          for (const p of data as Array<{ id: string; avatar_url: string | null }>) sig[p.id] = p.avatar_url;
          return sig;
        });
      });
  }, [clave]);

  // Presence: solo quien ya entró a la sala se anuncia.
  useEffect(() => {
    if (!jugadorId) return;
    const supabase = createClient();
    const canal = supabase.channel(`arena-publica-presencia:${salaId}`, {
      config: { presence: { key: jugadorId } },
    });
    canal
      .on("presence", { event: "sync" }, () => {
        setConectados(new Set(Object.keys(canal.presenceState())));
      })
      .subscribe((estado) => {
        if (estado === "SUBSCRIBED") void canal.track({ jugador_id: jugadorId });
      });
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [salaId, jugadorId]);

  const avatarDe = (j: ArenaJugador) => (j.user_id ? (avatares[j.user_id] ?? null) : null);
  // Uno mismo siempre cuenta como conectado.
  const conectado = (j: ArenaJugador) => j.id === jugadorId || conectados === null || conectados.has(j.id);

  return { avatarDe, conectado };
}
