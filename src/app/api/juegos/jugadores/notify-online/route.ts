import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushNotification } from "@/lib/push/webpush";

// 30 minutos: evita re-avisar a todos en cada recarga de página de la
// misma visita — solo se vuelve a notificar de este usuario si pasó ese
// tiempo desde el último aviso.
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Se llama desde el propio cliente del usuario que ACABA de conectarse
 * (ver PublicHeader.tsx) — nunca desde el cliente de otra persona. Server
 * decide, con auth.getUser() (no confía en ningún id que mande el body),
 * si esa persona está en la lista de Jugadores en línea y si toca avisar
 * al resto.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = await createServiceClient();

  const { data: propio } = await service
    .from("jugadores_en_linea")
    .select("id, nombre, last_online_notified_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // No está en la lista de "quiero que me inviten" — nada que avisar.
  if (!propio) return NextResponse.json({ notified: 0 });

  const lastNotified = (propio as { last_online_notified_at: string | null }).last_online_notified_at;
  if (lastNotified && Date.now() - new Date(lastNotified).getTime() < DEDUPE_WINDOW_MS) {
    return NextResponse.json({ notified: 0, reason: "deduped" });
  }

  const { data: resto } = await service
    .from("jugadores_en_linea")
    .select("user_id")
    .neq("user_id", user.id);

  const otrosIds = (resto ?? []).map((r) => (r as { user_id: string }).user_id);
  if (otrosIds.length === 0) return NextResponse.json({ notified: 0 });

  const { data: subs } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", otrosIds);

  const nombre = (propio as { nombre: string }).nombre;
  const payload = {
    title: "¡Alguien está listo para jugar! 🎮",
    body: `${nombre} se conectó — entra a Elim LLDM y ponte de acuerdo para una partida.`,
    url: "/juegos/jugadores",
  };

  const expiredIds: string[] = [];
  let sent = 0;

  await Promise.all(
    (subs ?? []).map(async (sub) => {
      const s = sub as { id: string; endpoint: string; p256dh: string; auth: string };
      const ok = await sendPushNotification(s, payload);
      if (ok) {
        sent++;
      } else {
        expiredIds.push(s.id);
      }
    })
  );

  if (expiredIds.length > 0) {
    await service.from("push_subscriptions").delete().in("id", expiredIds);
  }

  await service
    .from("jugadores_en_linea")
    .update({ last_online_notified_at: new Date().toISOString() })
    .eq("id", (propio as { id: string }).id);

  return NextResponse.json({ notified: sent });
}
