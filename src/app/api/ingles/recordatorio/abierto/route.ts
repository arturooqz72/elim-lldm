import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Abrió la app tocando el recordatorio (/ingles?aviso=<id>): se marca la
// hora, solo la primera vez y solo si el envío es suyo. Para estadísticas.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { envio?: unknown } | null;
  const envio = Number(body?.envio);
  if (!Number.isSafeInteger(envio) || envio <= 0) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = await createServiceClient();
  await admin
    .from("english_push_envios")
    .update({ abierto_at: new Date().toISOString() })
    .eq("id", envio)
    .eq("user_id", user.id)
    .is("abierto_at", null);
  return NextResponse.json({ ok: true });
}
