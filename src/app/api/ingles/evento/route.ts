import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { anonIdValido } from "@/lib/ingles/prueba.server";

const VALORES: Record<string, readonly string[]> = {
  boton_rapido: ["pronunciacion", "platicar", "reto", "principiante"],
  aviso_push: ["si", "ahora_no", "bloqueado", "apagado"],
};

// Guarda un evento de Elim English para /admin/ingles: qué botón de
// respuesta rápida tocaron y qué contestaron al aviso de recordatorios.
// Solo estadísticas; no cuesta mensajes ni cambia nada del usuario.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { tipo?: string; valor?: string; visitante?: string } | null;
  const tipo = body?.tipo ?? "";
  const valor = body?.valor ?? "";
  if (!VALORES[tipo]?.includes(valor)) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const visitanteId = anonIdValido(body?.visitante);
  if (!user && !visitanteId) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = await createServiceClient();
  const { error } = await admin
    .from("english_eventos")
    .insert({ user_id: user?.id ?? null, visitante_id: visitanteId, tipo, valor });
  if (error) {
    console.error("Elim English — no se guardó el evento:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
