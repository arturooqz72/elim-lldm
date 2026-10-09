// src/components/layout/useRegistrarVisita.ts
"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const CLAVE_VISITANTE = "elim-visitante-id";

/**
 * Id aleatorio por navegador para agrupar las visitas de quien no inició
 * sesión. Se manda también con sesión, para saber si ese navegador entró
 * antes sin cuenta (p. ej. "Volvieron a abrir" en /admin/ingles). Por sí
 * solo no identifica a nadie; si localStorage no está disponible (modo
 * privado, bloqueado) la visita se guarda sin él.
 */
function idVisitante(): string | null {
  try {
    let id = localStorage.getItem(CLAVE_VISITANTE);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLAVE_VISITANTE, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Guarda una fila en visitas_sitio cada vez que cambia la página pública
 * abierta (historial en /admin/historial). profile_id no se manda: la base
 * de datos lo toma de la sesión (DEFAULT auth.uid(), ver migración 0058).
 */
export function useRegistrarVisita(profileId: string | null, pathname: string) {
  const ultimaRef = useRef<string | null>(null);

  useEffect(() => {
    const clave = `${profileId ?? "anon"}|${pathname}`;
    if (ultimaRef.current === clave) return;
    ultimaRef.current = clave;

    const supabase = createClient();
    void supabase
      .from("visitas_sitio")
      .insert({ ruta: pathname.slice(0, 300), visitante_id: idVisitante() })
      .then(({ error }) => {
        if (error) console.warn("[visitas] no se pudo registrar la visita:", error.message);
      });
  }, [profileId, pathname]);
}
