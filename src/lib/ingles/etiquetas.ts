// src/lib/ingles/etiquetas.ts
// Textos en español de la interfaz de Elim English (se usa en cliente y servidor).

import type { InglesModo, InglesNivel, InglesPaqueteId, InglesSituacion } from "@/types";

export const NIVELES: InglesNivel[] = ["principiante", "intermedio", "avanzado"];
export const MODOS: InglesModo[] = ["conversacion", "situaciones", "gramatica", "vocabulario"];
export const SITUACIONES: InglesSituacion[] = ["restaurante", "entrevista", "medico", "aeropuerto"];

export const ETIQUETA_NIVEL: Record<InglesNivel, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

export const ETIQUETA_MODO: Record<InglesModo, string> = {
  conversacion: "Conversación libre",
  situaciones: "Situaciones",
  gramatica: "Corrección de gramática",
  vocabulario: "Vocabulario",
};

export const ETIQUETA_SITUACION: Record<InglesSituacion, string> = {
  restaurante: "Restaurante",
  entrevista: "Entrevista de trabajo",
  medico: "Cita médica",
  aeropuerto: "Aeropuerto",
};

export const ETIQUETA_PAQUETE: Record<InglesPaqueteId, string> = {
  basico: "Paquete básico",
  grande: "Paquete grande",
};

/** Primer mensaje que se muestra (no se guarda ni cuesta) cuando el modo está vacío. */
export const BIENVENIDA: Record<InglesModo, string> = {
  conversacion:
    "Hi! I'm your English tutor. ¡Hola! Escríbeme lo que quieras en inglés y platicamos. Si te equivocas, te corrijo y te explico en español.",
  situaciones:
    "Vamos a practicar una situación real. Elige arriba dónde estamos y escríbeme tu primera frase en inglés (o \"start\" para que yo empiece).",
  gramatica:
    "Escríbeme una o varias frases en inglés y te digo qué está bien, qué corregir y por qué.",
  vocabulario:
    "Escríbeme un tema (por ejemplo: \"comida\", \"trabajo\", \"viajes\") y te enseño palabras nuevas con un mini examen al final.",
};

export function formatoPrecio(centavos: number, moneda: string): string {
  const codigo = moneda.toUpperCase();
  const monto = new Intl.NumberFormat("es-MX", { style: "currency", currency: codigo, currencyDisplay: "narrowSymbol" })
    .format(centavos / 100);
  return `${monto} ${codigo}`;
}
