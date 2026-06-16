"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface LivePlatika {
  id: string;
  title: string;
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
    const supabase = createClient();

    async function refresh() {
      const { data } = await supabase
        .from("platikas")
        .select("id, title")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLive((data as LivePlatika | null) ?? null);
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
