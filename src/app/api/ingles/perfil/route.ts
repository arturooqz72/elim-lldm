import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { esModo, esNivel, esSituacion } from "@/lib/ingles/config";

// Guarda nivel, modo y situación elegidos. No cuesta mensajes; RLS solo deja
// que cada usuario escriba su propia fila.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { nivel?: string; modo?: string; situacion?: string }
    | null;

  if (!esNivel(body?.nivel) || !esModo(body?.modo) || !esSituacion(body?.situacion)) {
    return NextResponse.json({ error: "Opciones no válidas" }, { status: 400 });
  }

  const { error } = await supabase.from("english_perfiles").upsert({
    user_id: user.id,
    nivel: body.nivel,
    modo: body.modo,
    situacion: body.situacion,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Elim English — no se guardó el perfil:", error.message);
    return NextResponse.json({ error: "No se pudieron guardar tus opciones" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
