import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushNotification } from "@/lib/push/webpush";

export type GameKey = "arena_abierta" | "ruleta";

const GAME_LABELS: Record<GameKey, string> = {
  arena_abierta: "Trivia en línea",
  ruleta: "La Ruleta en línea",
};

/**
 * Avisa a todos los que activaron la campana de este juego (excepto quien
 * se acaba de unir) que hace falta gente para arrancar. Se llama desde las
 * rutas de join SOLO cuando la unión NO alcanzó el mínimo para empezar
 * (tryStartCounting/tryStartMatch → applied === false) — si el juego ya
 * arrancó, ya no hace falta reclutar a nadie más.
 *
 * Fire-and-forget a propósito: el llamador la invoca con `void`, no debe
 * hacer esperar la respuesta del join por el envío de notificaciones.
 */
export async function notifyGameWaiting(
  gameKey: GameKey,
  excludeUserId: string,
  salaUrl: string
): Promise<void> {
  const service = await createServiceClient();

  const { data: subs } = await service
    .from("game_notify_subscriptions")
    .select("user_id")
    .eq("game_key", gameKey)
    .neq("user_id", excludeUserId);

  const otrosIds = (subs ?? []).map((s) => (s as { user_id: string }).user_id);
  if (otrosIds.length === 0) return;

  const { data: pushSubs } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", otrosIds);

  if (!pushSubs || pushSubs.length === 0) return;

  const label = GAME_LABELS[gameKey];
  const payload = {
    title: `¡Listos para ${label}! 🎮`,
    body: "Alguien quiere jugar ahora — únete antes de que empiece.",
    url: salaUrl,
  };

  const expiredIds: string[] = [];

  await Promise.all(
    pushSubs.map(async (sub) => {
      const s = sub as { id: string; endpoint: string; p256dh: string; auth: string };
      const ok = await sendPushNotification(s, payload);
      if (!ok) expiredIds.push(s.id);
    })
  );

  if (expiredIds.length > 0) {
    await service.from("push_subscriptions").delete().in("id", expiredIds);
  }
}
