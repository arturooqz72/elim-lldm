import { NextResponse } from "next/server";
import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { enviarPrueba } from "@/lib/ingles/recordatorio.server";
import type { Profile } from "@/types";

// Solo admin: manda ya mismo un recordatorio de prueba a SUS teléfonos con
// el recordatorio activado (no a nadie más). Para probar sin esperar al cron.
export async function POST() {
  const profile = (await getProfile()) as Profile | null;
  if (profile?.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const admin = await createServiceClient();
    const r = await enviarPrueba(admin, profile.id);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error("Elim English — falló la notificación de prueba:", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
