"use client";

import { EntrarConCodigo } from "@/components/auth/EntrarConCodigo";

/**
 * Inicio de sesión con código dentro de la app instalada de Elim English.
 * Es el mismo flujo que /login (EntrarConCodigo): crea la cuenta si no
 * existe y le pide su nombre; aquí siempre vuelve a /ingles.
 */
export function InglesCodigo() {
  return <EntrarConCodigo returnUrl="/ingles" pedirCorreo />;
}
