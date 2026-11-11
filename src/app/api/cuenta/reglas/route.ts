// src/app/api/cuenta/reglas/route.ts
//
// Guarda "Acepto" de la regla general (fecha y versión) y el nombre para
// mostrar que eligió en la misma pantalla.
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NOMBRE_MAX, NOMBRE_MIN, REGLAS_VERSION } from "@/lib/reglas";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });

  let body: { version?: unknown; display_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  if (body.version !== REGLAS_VERSION) {
    return NextResponse.json({ error: "Las reglas cambiaron. Recarga la página." }, { status: 409 });
  }
  const nombre = typeof body.display_name === "string" ? body.display_name.replace(/\s+/g, " ").trim() : "";
  if (nombre.length < NOMBRE_MIN || nombre.length > NOMBRE_MAX) {
    return NextResponse.json({ error: `Tu nombre para mostrar debe tener de ${NOMBRE_MIN} a ${NOMBRE_MAX} letras` }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ display_name: nombre, acepto_reglas_en: new Date().toISOString(), acepto_reglas_version: REGLAS_VERSION })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
