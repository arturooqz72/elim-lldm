// src/lib/ingles/config.ts
// Configuración de Elim English, leída de variables de entorno (solo en el
// servidor). Los precios viven aquí y nunca llegan del navegador.

import type { InglesModo, InglesNivel, InglesPaquete, InglesPaqueteId, InglesSituacion } from "@/types";
import { MODOS, NIVELES, SITUACIONES } from "./etiquetas";

function entero(nombre: string, porDefecto: number): number {
  const n = Number.parseInt(process.env[nombre] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

function decimal(nombre: string, porDefecto: number): number {
  const n = Number.parseFloat(process.env[nombre] ?? "");
  return Number.isFinite(n) && n >= 0 ? n : porDefecto;
}

export function inglesConfig() {
  return {
    modelo: process.env.ENGLISH_MODEL || "claude-haiku-4-5",
    gratisDiarios: entero("ENGLISH_FREE_DAILY", 20),
    maxTokens: entero("ENGLISH_MAX_TOKENS", 600),
    maxCaracteres: entero("ENGLISH_MAX_CHARS", 1000),
    /** Mensajes previos que se mandan al modelo (no todo el historial). */
    historial: entero("ENGLISH_HISTORY_LIMIT", 12),
    /** Mensajes que cuesta cada intento de pronunciación. */
    costoPronunciacion: entero("ENGLISH_PRONUNCIATION_COST", 3),
    /** Duración máxima de la grabación (también se valida en el servidor). */
    pronMaxSegundos: entero("ENGLISH_PRON_MAX_SECONDS", 15),
    /** Tope de frases nuevas generadas por usuario por día (costo de Anthropic). */
    pronFrasesDiarias: entero("ENGLISH_PRON_DAILY_PHRASES", 60),
    /** Prueba sin cuenta: mensajes por visitante (cookie). */
    pruebaMensajes: entero("ENGLISH_TRIAL_MESSAGES", 3),
    /**
     * Prueba sin cuenta: mensajes por IP por día. Más que pruebaMensajes
     * porque varias personas pueden compartir IP (familia, iglesia, datos
     * móviles); solo frena a quien borra la cookie para volver a empezar.
     */
    pruebaPorIpDiaria: entero("ENGLISH_TRIAL_IP_DAILY", 6),
    /** Prueba sin cuenta: tope de todo el sitio por día (cuida el costo). */
    pruebaGlobalDiaria: entero("ENGLISH_TRIAL_GLOBAL_DAILY", 300),
    /**
     * Precio estimado de Azure por hora de audio evaluado: ~$1.00 de
     * speech-to-text + ~$0.30 de Pronunciation Assessment. Con el plan
     * gratis (F0) las primeras 5 horas al mes no se cobran.
     */
    azureUsdPorHora: decimal("ENGLISH_AZURE_USD_PER_HOUR", 1.3),
  };
}

/**
 * Venta de créditos activa. Por defecto apagada: solo "true" la enciende.
 * Apagada, al llegar al límite se ofrece la lista de espera en vez de los
 * paquetes, se oculta el contador de créditos y el checkout se rechaza.
 */
export function pagosActivos(): boolean {
  return process.env.ENGLISH_PAYMENTS_ENABLED === "true";
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
