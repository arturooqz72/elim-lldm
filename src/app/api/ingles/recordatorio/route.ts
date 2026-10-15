import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const PLATAFORMAS = ["ios", "android", "otro"];

interface Cuerpo {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  zona?: string;
  plataforma?: string;
}

function zonaValida(zona: unknown): string | null {
  if (typeof zona !== "string" || zona.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zona });
    return zona;
  } catch {
    return null;
  }
}

async function usuario() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Activa el recordatorio diario de Elim English en este teléfono/navegador.
// Solo con cuenta. La misma suscripción (endpoint) se actualiza, no se duplica.
export async function POST(request: Request) {
  const user = await usuario();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Cuerpo | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (
    typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000 ||
    typeof p256dh !== "string" || p256dh.length > 200 ||
    typeof auth !== "string" || auth.length > 100
  ) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }

  const admin = await createServiceClient();
  const { error } = await admin.from("english_push_suscripciones").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      zona_horaria: zonaValida(body?.zona),
      plataforma: PLATAFORMAS.includes(body?.plataforma ?? "") ? body!.plataforma : "otro",
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("Elim English — no se guardó la suscripción:", error.message);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Apaga el recordatorio en este teléfono (solo borra la suscripción propia).
export async function DELETE(request: Request) {
  const user = await usuario();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Cuerpo | null;
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Falta endpoint" }, { status: 400 });

  const admin = await createServiceClient();
  await admin.from("english_push_suscripciones").delete().eq("endpoint", body.endpoint).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
