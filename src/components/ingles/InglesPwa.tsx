"use client";

import { useEffect } from "react";
import { abiertaComoApp, iniciarInstalacion, plataforma } from "./instalacionApp";

const CLAVE_APERTURA = "elim-english-apertura";
const CLAVE_VISITANTE = "elim-visitante-id"; // el mismo id anónimo que usa el historial de visitas

/** Mismo criterio que useRegistrarVisita: si todavía no existe, se crea. */
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
 * Va en el layout de /ingles:
 * - registra el service worker de Elim English (scope /ingles);
 * - empieza a escuchar el aviso de instalación del navegador;
 * - si la página se abrió como app instalada, avisa al servidor UNA vez por
 *   sesión (cada vez que se abre la app; cambiar de página no cuenta).
 */
export function InglesPwa() {
  useEffect(() => {
    iniciarInstalacion();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/ingles-sw.js", { scope: "/ingles" }).catch(() => {});
    }

    if (!abiertaComoApp()) return;
    try {
      if (sessionStorage.getItem(CLAVE_APERTURA)) return;
      sessionStorage.setItem(CLAVE_APERTURA, "1");
    } catch {
      // sin sessionStorage se cuenta igual; el servidor ignora repeticiones cercanas
    }
    void fetch("/api/ingles/app-abierta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plataforma: plataforma(), visitante: idVisitante() }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
