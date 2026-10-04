"use client";

import { useEffect, useState } from "react";
import { createFreshClient } from "@/lib/supabase/client";
import { PREFIJO_VISITANTE, type PresenciaSitio } from "@/components/layout/usePresenciaSitio";

export interface Conectado {
  id: string;
  rutas: string[];
  desde: string | null;
}

/**
 * Escucha el canal presence:site (sin marcarse a sí mismo: el admin no monta
 * PublicHeader) y separa usuarios con sesión de visitantes sin cuenta. Lo usan
 * el Dashboard y /admin/en-linea.
 */
export function useConectadosSitio() {
  const [usuarios, setUsuarios] = useState<Conectado[]>([]);
  const [visitantes, setVisitantes] = useState<Array<{ ruta?: string }>>([]);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    // Cliente propio, no el singleton (ver JugadoresEnLineaList.tsx).
    const supabase = createFreshClient();
    const canal = supabase.channel("presence:site");
    canal
      .on("presence", { event: "sync" }, () => {
        const estado = canal.presenceState<Partial<PresenciaSitio>>();
        const nuevosUsuarios: Conectado[] = [];
        const nuevosVisitantes: Array<{ ruta?: string }> = [];
        for (const [clave, metas] of Object.entries(estado)) {
          if (clave.startsWith(PREFIJO_VISITANTE)) {
            nuevosVisitantes.push({ ruta: metas[0]?.ruta });
            continue;
          }
          // Varias pestañas de la misma cuenta llegan como varias metas.
          const rutas = [...new Set(metas.map((m) => m.ruta).filter((r): r is string => Boolean(r)))];
          const desde = metas.map((m) => m.online_at).filter((d): d is string => Boolean(d)).sort()[0] ?? null;
          nuevosUsuarios.push({ id: clave, rutas, desde });
        }
        setUsuarios(nuevosUsuarios);
        setVisitantes(nuevosVisitantes);
      })
      .subscribe((status) => setConectado(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  return { usuarios, visitantes, conectado };
}
