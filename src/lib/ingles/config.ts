// src/lib/ingles/config.ts
// Configuración de Elim English, leída de variables de entorno (solo en el
// servidor). Los precios viven aquí y nunca llegan del navegador.

import type { InglesModo, InglesNivel, InglesPaquete, InglesPaqueteId, InglesSituacion } from "@/types";
import { MODOS, NIVELES, SITUACIONES } from "./etiquetas";

function entero(nombre: string, porDefecto: number): number {
  const n = Number.parseInt(process.env[nombre] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

export function inglesConfig() {
  return {
    modelo: process.env.ENGLISH_MODEL || "claude-haiku-4-5",
    gratisDiarios: entero("ENGLISH_FREE_DAILY", 20),
    maxTokens: entero("ENGLISH_MAX_TOKENS", 600),
    maxCaracteres: entero("ENGLISH_MAX_CHARS", 1000),
    /** Mensajes previos que se mandan al modelo (no todo el historial). */
    historial: entero("ENGLISH_HISTORY_LIMIT", 12),
  };
}

export function inglesPaquetes(): InglesPaquete[] {
  const moneda = (process.env.ENGLISH_CURRENCY || "usd").toLowerCase();
  return [
    {
      id: "basico",
      mensajes: entero("ENGLISH_PACK_BASIC_MESSAGES", 300),
      precioCentavos: entero("ENGLISH_PACK_BASIC_PRICE_CENTS", 500),
      moneda,
    },
    {
      id: "grande",
      mensajes: entero("ENGLISH_PACK_LARGE_MESSAGES", 1000),
      precioCentavos: entero("ENGLISH_PACK_LARGE_PRICE_CENTS", 1200),
      moneda,
    },
  ];
}

export function buscarPaquete(id: unknown): InglesPaquete | null {
  return inglesPaquetes().find((p) => p.id === (id as InglesPaqueteId)) ?? null;
}

export function esNivel(v: unknown): v is InglesNivel {
  return typeof v === "string" && (NIVELES as string[]).includes(v);
}
export function esModo(v: unknown): v is InglesModo {
  return typeof v === "string" && (MODOS as string[]).includes(v);
}
export function esSituacion(v: unknown): v is InglesSituacion {
  return typeof v === "string" && (SITUACIONES as string[]).includes(v);
}
