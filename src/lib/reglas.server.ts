// src/lib/reglas.server.ts
import "server-only";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { aceptoVersionActual } from "./reglas";

/** Si el usuario ya aceptó la versión actual de la regla. */
export async function aceptoReglas(userId: string): Promise<boolean> {
  const service = await createServiceClient();
  const { data } = await service.from("profiles").select("acepto_reglas_version").eq("id", userId).maybeSingle();
  return aceptoVersionActual((data?.acepto_reglas_version as string | null | undefined) ?? null);
}

/** Respuesta común cuando falta aceptar la regla. */
export function faltaAceptarReglas() {
  // "error" lo leen Trivia, Ruleta, Ahorcado y la Liga; "mensaje", Palabra del Día.
  const texto = "Acepta las reglas de los juegos para jugar";
  return NextResponse.json({ error: texto, mensaje: texto, codigo: "reglas" }, { status: 403 });
}
