// src/components/layout/usePresenciaSitio.ts
"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** Lo que cada pestaña publica en el canal "presence:site". */
export interface PresenciaSitio {
  tipo: "usuario" | "visitante";
  /** Página pública que tiene abierta (pathname, sin query). */
  ruta: string;
  /** Desde cuándo está conectada esta pestaña. */
  online_at: string;
}

/** Prefijo de la clave de presencia de quien no inició sesión. */
export const PREFIJO_VISITANTE = "visitante-";

/**
 * Marca esta pestaña como "en línea" en el canal compartido presence:site.
 *
 * - Con sesión, la clave es el id del perfil: /juegos/jugadores la cruza con
 *   su lista de invitación, y /admin/en-linea resuelve el nombre.
 * - Sin sesión, la clave es "visitante-<uuid>" por pestaña: solo suma al
 *   contador de visitantes del admin (no lleva ningún dato personal).
 *
 * Al navegar se vuelve a publicar con la ruta nueva (track() reemplaza el
 * estado anterior de esta pestaña, no agrega otro).
 */
export function usePresenciaSitio(profileId: string | null, pathname: string) {
  const canalRef = useRef<RealtimeChannel | null>(null);
  const listoRef = useRef(false);
  const rutaRef = useRef(pathname);
  const desdeRef = useRef("");

  useEffect(() => {
    const supabase = createClient();
    const clave = profileId ?? `${PREFIJO_VISITANTE}${crypto.randomUUID()}`;
    const tipo: PresenciaSitio["tipo"] = profileId ? "usuario" : "visitante";
    desdeRef.current = new Date().toISOString();

    const canal = supabase.channel("presence:site", { config: { presence: { key: clave } } });
    canalRef.current = canal;
    canal.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      listoRef.current = true;
      void canal.track({ tipo, ruta: rutaRef.current, online_at: desdeRef.current } satisfies PresenciaSitio);
    });

    return () => {
      listoRef.current = false;
      canalRef.current = null;
      supabase.removeChannel(canal);
    };
  }, [profileId]);

  useEffect(() => {
    rutaRef.current = pathname;
    if (!listoRef.current || !canalRef.current) return;
    void canalRef.current.track({
      tipo: profileId ? "usuario" : "visitante",
      ruta: pathname,
      online_at: desdeRef.current,
    } satisfies PresenciaSitio);
  }, [pathname, profileId]);
}
