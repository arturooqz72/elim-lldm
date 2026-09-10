import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AhorcadoPalabra } from "@/types";

// Usa el service role a propósito: ahorcado_palabras no tiene ninguna
// policy de SELECT pública (ver 0034_ahorcado_nt.sql), así que un cliente
// normal de sesión no podría leer ni una fila aquí. La ruta sí exige sesión
// (ver chequeo abajo) para no dejar que un visitante sin cuenta raspe el
// banco pidiendo esta ruta en bucle.
export async function GET() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 });
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from("ahorcado_palabras")
    .select("id, palabra, categoria, pista, referencia_biblica")
    .eq("activo", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const palabras = (data ?? []) as Pick<
    AhorcadoPalabra,
    "id" | "palabra" | "categoria" | "pista" | "referencia_biblica"
  >[];

  if (palabras.length === 0) {
    return NextResponse.json({ error: "No hay palabras activas en el banco" }, { status: 500 });
  }

  const elegida = palabras[Math.floor(Math.random() * palabras.length)];
  return NextResponse.json(elegida);
}
