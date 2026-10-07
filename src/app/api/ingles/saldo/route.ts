import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { leerSaldo } from "@/lib/ingles/saldo.server";

// Saldo actual (mensajes gratis de hoy + créditos). Lo consulta /ingles al
// volver de Stripe, mientras llega el webhook que acredita la compra.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  return NextResponse.json(await leerSaldo(supabase, user.id));
}
