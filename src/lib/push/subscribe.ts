// src/lib/push/subscribe.ts — helpers de cliente para Web Push.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** Estado actual del permiso del navegador, sin pedirlo. */
export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  return Notification.permission;
}

/**
 * Pide permiso (si hace falta), registra el service worker si no estaba, y
 * manda la suscripción al servidor. Lanza un Error con mensaje legible si
 * el usuario niega el permiso o el navegador no soporta push.
 */
export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Tu navegador no soporta notificaciones push.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("No diste permiso para las notificaciones.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // BufferSource: TS's DOM lib wants ArrayBufferView<ArrayBuffer>
      // specifically (excludes SharedArrayBuffer), stricter than what
      // Uint8Array's own type declares — safe cast, this buffer is never
      // shared.
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ) as BufferSource,
    }));

  const json = subscription.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });

  if (!res.ok) throw new Error("No se pudo guardar la suscripción en el servidor.");
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {
    // best-effort — si falla, la suscripción ya quedó inválida en el
    // navegador de todas formas, y notifyGameWaiting() la limpiará sola en
    // el próximo intento fallido de envío (ver sendPushNotification).
  });
}
