import "server-only";
import webpush from "web-push";

// VAPID: identifica al servidor ante los servicios push de cada navegador
// (Google/Mozilla/Apple) sin necesitar Firebase ni ningún servicio de
// terceros — es el estándar Web Push nativo. La llave pública también vive
// en NEXT_PUBLIC_VAPID_PUBLIC_KEY (esa sí va al cliente, para suscribirse).
webpush.setVapidDetails(
  "mailto:contacto@elimlldm.net",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Manda un push a una sola suscripción. Devuelve false (sin lanzar) si la
 * suscripción ya no es válida (código 404/410 — el navegador la revocó,
 * ej. el usuario desinstaló la PWA o limpió el permiso) para que el
 * llamador la borre de la tabla; cualquier otro error sí se relanza.
 */
export async function sendPushNotification(
  sub: PushSubscriptionRow,
  payload: PushPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return true;
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) return false;
    throw err;
  }
}
