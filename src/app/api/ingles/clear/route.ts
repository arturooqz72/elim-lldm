import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { esModo } from "@/lib/ingles/config";

// Borra la conversación del modo actual. No devuelve mensajes ya usados.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { modo?: string } | null;
  if (!esModo(body?.modo)) return NextResponse.json({ error: "Modo no válido" }, { status: 400 });

  await supabase.from("english_mensajes").delete().eq("user_id", user.id).eq("modo", body.modo);

  return NextResponse.json({ ok: true });
}
