import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { anonIdValido } from "@/lib/ingles/prueba.server";

const PLATAFORMAS = ["ios", "android", "otro"] as const;
type Plataforma = (typeof PLATAFORMAS)[number];
/** Una apertura de la misma persona dentro de este lapso se ignora (recargas, dobles envíos). */
const MINUTOS_REPETIDA = 5;

// Cuenta una apertura de Elim English desde la app instalada. Solo para
// estadísticas: no cuesta mensajes ni cambia nada del usuario.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { plataforma?: string; visitante?: string } | null;
  const plataforma: Plataforma = PLATAFORMAS.includes(body?.plataforma as Plataforma)
    ? (body!.plataforma as Plataforma)
    : "otro";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const visitanteId = userId ? null : anonIdValido(body?.visitante);
  if (!userId && !visitanteId) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = await createServiceClient();
  const desde = new Date(Date.now() - MINUTOS_REPETIDA * 60_000).toISOString();
  const previa = admin.from("english_app_aperturas").select("id").gte("created_at", desde).limit(1);
  const { data: repetida } = await (userId ? previa.eq("user_id", userId) : previa.eq("visitante_id", visitanteId!));
  if (repetida?.length) return NextResponse.json({ ok: true, repetida: true });

  const { error } = await admin
    .from("english_app_aperturas")
    .insert({ user_id: userId, visitante_id: visitanteId, plataforma });
  if (error) {
    console.error("Elim English — no se registró la apertura de la app:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
