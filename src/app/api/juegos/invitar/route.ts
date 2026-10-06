import { NextResponse } from "next/server";
import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { canalInvitacion, EVENTO_INVITACION, juegoInvitacion } from "@/lib/invitaciones";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Manda una invitación a jugar a alguien conectado (ver InvitacionJuego.tsx).
// La usan las salas de espera (InvitarConectados) y /admin/en-linea. Exige
// sesión; el nombre de quien invita sale de su perfil, no del cliente.
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
  const canal = service.channel(canalInvitacion(userId));
  const resultado = await canal.send({
    type: "broadcast",
    event: EVENTO_INVITACION,
    payload: { juego: juego.clave, de: profile.display_name.slice(0, 40) },
  });
  await service.removeChannel(canal);

  if (resultado !== "ok") {
    return NextResponse.json({ error: "No se pudo enviar la invitación" }, { status: 502 });
  }
  return NextResponse.json({ enviado: true });
}
