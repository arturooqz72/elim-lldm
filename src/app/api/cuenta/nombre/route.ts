import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const MIN = 2;
const MAX = 40;

// Guarda el nombre de una cuenta creada con el código por correo (que nace
// con la parte del correo antes de la @ como nombre) y quita la marca
// nombre_pendiente para que /ingles ya no lo pida.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión primero." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { nombre?: unknown } | null;
  const nombre = typeof body?.nombre === "string" ? body.nombre.replace(/\s+/g, " ").trim() : "";
  if (nombre.length < MIN || nombre.length > MAX) {
    return NextResponse.json({ error: `Escribe un nombre de ${MIN} a ${MAX} letras.` }, { status: 400 });
  }

  // Service role: la sesión del usuario no siempre puede escribir todo su perfil.
  const admin = await createServiceClient();
  const { error } = await admin.from("profiles").update({ display_name: nombre }).eq("id", user.id);
  if (error) {
    console.error("Elim English — no se guardó el nombre:", error.message);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, full_name: nombre, nombre_pendiente: false },
  });
  return NextResponse.json({ ok: true });
}
