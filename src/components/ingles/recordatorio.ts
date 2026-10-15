"use client";

// Recordatorio diario de Elim English (Web Push) del lado del navegador.
// Usa el service worker de la app de inglés (/ingles-sw.js, scope /ingles),
// no el del resto del sitio: así funciona dentro de la app instalada (en
// iPhone es la única forma). Las suscripciones de los juegos no se tocan.

import { useEffect, useState } from "react";
import { abiertaComoApp, plataforma } from "./instalacionApp";

export type EstadoRecordatorio =
  | "cargando"
  | "no_soportado"
  /** iPhone en Safari: las notificaciones solo funcionan con la app en la pantalla de inicio. */
  | "iphone_sin_app"
  /** La persona (o el navegador) bloqueó las notificaciones del sitio. */
  | "bloqueado"
  | "activo"
  | "inactivo";

let estado: EstadoRecordatorio = "cargando";
let leyendo: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function cambiar(nuevo: EstadoRecordatorio) {
  estado = nuevo;
  for (const fn of oyentes) fn();
}

function soportado(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  const reg =
    (await navigator.serviceWorker.getRegistration("/ingles")) ??
    (await navigator.serviceWorker.register("/ingles-sw.js", { scope: "/ingles" }));
  if (reg.active) return reg;
  // Recién registrado: hay que esperar a que quede activo antes de suscribirse.
  const pendiente = reg.installing ?? reg.waiting;
  await new Promise<void>((listo) => {
    if (!pendiente) return listo();
    pendiente.addEventListener("statechange", () => {
      if (pendiente.state === "activated") listo();
    });
  });
  return reg;
}

async function leerEstado(): Promise<void> {
  if (plataforma() === "ios" && !abiertaComoApp()) return cambiar("iphone_sin_app");
  if (!soportado()) return cambiar("no_soportado");
  if (Notification.permission === "denied") return cambiar("bloqueado");
  const reg = await navigator.serviceWorker.getRegistration("/ingles");
  const sub = await reg?.pushManager.getSubscription();
  cambiar(sub && Notification.permission === "granted" ? "activo" : "inactivo");
}

/** Estado del recordatorio en este teléfono/navegador, compartido entre el aviso y la campana. */
export function useEstadoRecordatorio(): EstadoRecordatorio {
  const [actual, setActual] = useState(estado);
  useEffect(() => {
    const fn = () => setActual(estado);
    oyentes.add(fn);
    if (!leyendo) leyendo = leerEstado().catch(() => cambiar("no_soportado"));
    fn();
    return () => {
      oyentes.delete(fn);
    };
  }, []);
  return actual;
}

function claveBase64(base64: string): Uint8Array {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

/**
 * Pide el permiso del navegador y guarda la suscripción. Debe llamarse
 * directo desde un toque (iPhone solo muestra el permiso así).
 */
export async function activarRecordatorio(): Promise<"activo" | "bloqueado" | "error"> {
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      cambiar(permiso === "denied" ? "bloqueado" : "inactivo");
      return "bloqueado";
    }
    const reg = await registro();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveBase64(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "") as BufferSource,
      }));
    const json = sub.toJSON();
    const res = await fetch("/api/ingles/recordatorio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
        plataforma: plataforma(),
      }),
    });
    if (!res.ok) throw new Error("no se guardó la suscripción");
    cambiar("activo");
    return "activo";
  } catch (err) {
    console.error("Elim English — no se activó el recordatorio:", err);
    return "error";
  }
}

export async function apagarRecordatorio(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/ingles");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/ingles/recordatorio", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  cambiar("inactivo");
}
