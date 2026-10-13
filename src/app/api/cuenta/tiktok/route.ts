// src/app/api/cuenta/tiktok/route.ts
//
// Guarda el permiso "Acepto que mi nombre y foto aparezcan en los videos
// de Elim LLDM en TikTok" (0078). Solo la propia cuenta, con sesión; se
// escribe con service role porque la columna no es pública (0076).
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar tu permiso." }, { status: 401 });

  let acepta: unknown;
  try {
    ({ acepta } = (await request.json()) as { acepta?: unknown });
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (typeof acepta !== "boolean") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ tiktok_permiso: acepta, tiktok_permiso_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    console.error("[tiktok] no se guardó el permiso:", error.message);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ acepta });
}
