import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Borra el historial de conversación de un número de WhatsApp.
// El bot lo llama cuando alguien escribe el comando !limpiar.

function isAuthorized(request: Request): boolean {
  const secret = process.env.WHATSAPP_BOT_SECRET;
  if (!secret) return false;
  return request.headers.get("x-whatsapp-secret") === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { from?: string } | null;
  const phoneNumber = body?.from?.trim();

  if (!phoneNumber) {
    return NextResponse.json({ error: "Falta el número de teléfono (from)" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  await supabase.from("whatsapp_ia_messages").delete().eq("phone_number", phoneNumber);

  return NextResponse.json({ cleared: true });
}
