"use client";

import { useEffect, useId, useState } from "react";
import { createFreshClient } from "@/lib/supabase/client";

export interface LivePlatika {
  id: string;
  title: string;
  programa_nombre: string | null;
}

/**
 * Tracks the current live "Estudio en Vivo" session (if any), updating in
 * real time as platikas change status. Pass `initial` when the caller
 * already fetched this server-side to avoid a redundant first query.
 */
export function useLivePlatika(initial: LivePlatika | null = null) {
  const [live, setLive] = useState<LivePlatika | null>(initial);
  const instanceId = useId();

  useEffect(() => {
    // createFreshClient(), no el singleton createClient(): el singleton
    // compartido puede quedarse con su initializePromise colgado para
    // siempre si el refresh de token inicial nunca se resuelve, lo cual
    // congela en silencio cualquier consulta futura sobre esa instancia
    // (gotcha ya documentado en src/lib/supabase/client.ts). Este hook
    // vive en el header, montado en cada página — no puede depender de
    // que el singleton esté sano en ese momento.
    const supabase = createFreshClient();

    async function refresh() {
      const { data } = await supabase
        .from("platikas")
        .select("id, title, programas(nombre)")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = data as unknown as { id: string; title: string; programas: { nombre: string } | null } | null;
      setLive(row ? { id: row.id, title: row.title, programa_nombre: row.programas?.nombre ?? null } : null);
    }

    if (initial === null) refresh();

    const channel = supabase
      .channel(`platikas-live-status-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platikas" },
        refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return live;
}
