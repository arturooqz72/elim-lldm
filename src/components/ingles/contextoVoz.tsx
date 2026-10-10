"use client";

import { createContext, useContext } from "react";
import type { InglesNivel, InglesSaldo } from "@/types";

/**
 * Lo que necesitan las tarjetas de voz del chat (🔊/🎤) y que vive en el chat
 * con cuenta (InglesChat) o en la prueba sin cuenta (InglesPrueba).
 */
export interface ContextoVoz {
  /** true en la prueba sin cuenta (1 intento; luego la invitación a crear cuenta). */
  prueba: boolean;
  nivel: InglesNivel;
  maxSegundos: number;
  /** Intentos de voz que quedan hoy (o en la prueba). */
  restantes: number;
  /** El servidor respondió: saldo nuevo (con cuenta) o intentos de prueba restantes. */
  actualizar: (r: { saldo?: InglesSaldo; vozPrueba?: number }) => void;
  /** Llegó al límite de voz (con cuenta) o ya usó su intento de prueba. */
  alLimite: () => void;
}

export const VozContext = createContext<ContextoVoz | null>(null);

export function useVoz(): ContextoVoz | null {
  return useContext(VozContext);
}
