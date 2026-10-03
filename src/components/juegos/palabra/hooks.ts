// src/components/juegos/palabra/hooks.ts
"use client";

import { useEffect, useRef } from "react";
import { fechaEnZona } from "@/lib/palabra/logica";
import type { PalabraEstadoJugador } from "@/types";
import { borrarPartidasLocales, partidasParaSincronizar } from "./almacenamiento";

/**
 * Con sesión: si quedó progreso de cuando jugaba sin sesión en este
 * dispositivo, se sube UNA vez a la cuenta (el servidor lo revalida todo) y
 * se limpia lo local. Si falla (sin red, error), se deja para la próxima visita.
 */
export function useSincronizacionLocal(
  conSesion: boolean,
  fecha: string,
  onEstado: (estado: PalabraEstadoJugador) => void,
  onAviso: (mensaje: string, ms?: number) => void
) {
  const hecho = useRef(false);

  useEffect(() => {
    if (!conSesion || hecho.current) return;
    hecho.current = true;
    const partidas = partidasParaSincronizar(fecha);
    if (partidas.length === 0) {
      borrarPartidasLocales();
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/juegos/palabra/sincronizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partidas }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { importadas: number; estado: PalabraEstadoJugador };
        borrarPartidasLocales();
        onEstado(data.estado);
        if (data.importadas > 0) {
          onAviso(
            data.importadas === 1
              ? "Guardamos en tu cuenta tu partida de este dispositivo"
              : `Guardamos en tu cuenta ${data.importadas} partidas de este dispositivo`,
            3500
          );
        }
      } catch {
        // sin red: se reintenta en la próxima visita
      }
    })();
  }, [conSesion, fecha, onEstado, onAviso]);
}

/** Si la página queda abierta y cambia el día, recarga para mostrar la palabra nueva. */
export function useRecargaAlCambiarDia(fecha: string) {
  useEffect(() => {
    const id = window.setInterval(() => {
      if (fechaEnZona() !== fecha) window.location.reload();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [fecha]);
}

/**
 * Teclado físico: letras (con o sin acento), Enter y Backspace. Se ignora
 * si se está escribiendo en un campo de texto o con Ctrl/Cmd/Alt. El ref
 * evita re-registrar el listener en cada render y siempre llama a la
 * versión más reciente del manejador.
 */
export function useTecladoFisico(onTecla: (tecla: string) => void) {
  const ref = useRef(onTecla);
  useEffect(() => {
    ref.current = onTecla;
  });

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const destino = e.target as HTMLElement | null;
      if (destino && (destino.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(destino.tagName))) return;
      if (e.key === "Enter") {
        e.preventDefault();
        ref.current("ENVIAR");
      } else if (e.key === "Backspace") {
        ref.current("BORRAR");
      } else if (e.key.length === 1) {
        ref.current(e.key);
      }
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, []);
}
