import { NextResponse } from "next/server";
import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { canalInvitacion, EVENTO_INVITACION, juegoInvitacion } from "@/lib/invitaciones";
import { sendPushNotification } from "@/lib/push/webpush";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Una invitación de la misma persona a la misma persona cada 2 minutos.
const ESPERA_MS = 2 * 60 * 1000;

// Manda una invitación a jugar (ver InvitacionJuego.tsx): un aviso dentro
// del sitio por Realtime, si la persona lo tiene abierto, y además una
// notificación push si se apuntó a la lista de jugadores y activó las
// notificaciones en su navegador. Nadie ve el número de WhatsApp de nadie.
// La usan las salas de espera (InvitarConectados), /juegos/jugadores y
// /admin/en-linea. Exige sesión; el nombre de quien invita sale de su
// perfil, no del cliente.
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });

  let body: { user_id?: unknown; juego?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const juego = juegoInvitacion(body.juego);
  if (!UUID.test(userId) || userId === profile.id || !juego) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: reciente } = await service
    .from("juego_invitaciones")
    .select("id")
    .eq("de", profile.id)
    .eq("para", userId)
    .gte("created_at", new Date(Date.now() - ESPERA_MS).toISOString())
    .limit(1)
    .maybeSingle();
  if (reciente) {
    return NextResponse.json(
      { error: "Ya lo invitaste hace un momento. Espera un par de minutos para volver a invitarlo." },
      { status: 429 }
    );
  }

  const de = profile.display_name.slice(0, 40);

  const canal = service.channel(canalInvitacion(userId));
  const resultado = await canal.send({
    type: "broadcast",
    event: EVENTO_INVITACION,
    payload: { juego: juego.clave, de },
  });
  await service.removeChannel(canal);

  // Push solo a quien se apuntó a la lista de jugadores (pidió que lo
  // invitaran), a todos sus navegadores con notificaciones activadas.
  let pushEnviados = 0;
  const { data: apuntado } = await service
    .from("jugadores_en_linea")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (apuntado) {
    const { data: subs } = await service
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    const vencidas: string[] = [];
    await Promise.all(
      ((subs ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
        const ok = await sendPushNotification(s, {
          title: `${de} te invita a jugar 🎮`,
          body: `¡La Paz del Señor! Te espera en ${juego.nombre}.`,
          url: juego.href,
        }).catch((err) => {
          // Error pasajero del servicio push: no se borra la suscripción.
          console.error("[juegos/invitar] Falló un push:", err);
          return null;
        });
        if (ok === true) pushEnviados++;
        else if (ok === false) vencidas.push(s.id);
      })
    );
    if (vencidas.length > 0) await service.from("push_subscriptions").delete().in("id", vencidas);
  }

  await service
    .from("juego_invitaciones")
    .insert({ de: profile.id, para: userId, juego: juego.clave, push_enviados: pushEnviados });

  if (resultado !== "ok" && pushEnviados === 0) {
    return NextResponse.json({ error: "No se pudo enviar la invitación" }, { status: 502 });
  }
  return NextResponse.json({ enviado: true, push: pushEnviados > 0 });
}
