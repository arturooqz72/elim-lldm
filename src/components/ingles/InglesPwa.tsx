"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { abiertaComoApp, iniciarInstalacion, plataforma } from "./instalacionApp";

const CLAVE_APERTURA = "elim-english-apertura";
const CLAVE_VISITANTE = "elim-visitante-id"; // el mismo id anónimo que usa el historial de visitas
/** Cada cuánto, como máximo, se pide al servidor que renueve las cookies de sesión. */
const MINUTOS_RENOVAR = 10;
let ultimaRenovacion = 0;

/**
 * Ver /api/ingles/sesion: que la sesión de la app dure 400 días y no 7
 * (Safari). La ruta devuelve las cookies que recibe, así que primero se espera
 * a que termine cualquier renovación en curso (getSession), y si el token se
 * renueva mientras tanto se vuelve a llamar con las cookies nuevas: nunca
 * debe quedar guardada una sesión vieja.
 */
async function renovarSesion(forzar = false) {
  if (!forzar && Date.now() - ultimaRenovacion < MINUTOS_RENOVAR * 60_000) return;
  ultimaRenovacion = Date.now();
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  let renovada = false;
  const { data: escucha } = supabase.auth.onAuthStateChange((evento) => {
    if (evento === "TOKEN_REFRESHED") renovada = true;
  });
  try {
    await fetch("/api/ingles/sesion", { method: "POST", keepalive: true });
  } catch {
    // sin conexión: se intenta la próxima vez
  } finally {
    escucha.subscription.unsubscribe();
  }
  if (renovada) await renovarSesion(true);
}

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

    // Al abrir (después de que el cliente de Supabase renueve la sesión, si
    // tocaba) y al salir de la app, que la última escritura sea del servidor.
    const alAbrir = window.setTimeout(() => void renovarSesion(), 4000);
    const alSalir = () => {
      if (document.visibilityState === "hidden") void renovarSesion();
    };
    document.addEventListener("visibilitychange", alSalir);
    const limpiar = () => {
      window.clearTimeout(alAbrir);
      document.removeEventListener("visibilitychange", alSalir);
    };

    try {
      if (sessionStorage.getItem(CLAVE_APERTURA)) return limpiar;
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
    return limpiar;
  }, []);

  return null;
}
