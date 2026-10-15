"use client";

import { useState } from "react";
import { alAzar, ETIQUETA_BOTON, RESPUESTAS_PLATICAR, RESPUESTAS_PRINCIPIANTE, type BotonRapido } from "@/lib/ingles/saludos";
import { registrarEvento } from "./visitante";
import type { ChatMsg } from "./chatAyudas";

interface Opciones {
  /** Saludo elegido en el servidor (así no cambia al hidratar la página). */
  inicial: string | null;
  /**
   * Agrega mensajes que solo viven en pantalla (no se guardan ni cuestan).
   * deBoton: vienen de "Platicar" o "Soy principiante", que contestan en
   * Conversación libre; si no, van a la conversación que esté abierta.
   */
  agregarLocales: (mensajes: ChatMsg[], deBoton: boolean) => void;
  /** Acciones de cada botón que no son contestar en el chat. */
  abrirPronunciacion: () => void;
  abrirReto?: () => void;
  ponerPrincipiante?: () => void;
  /** Antes de contestar con "Platicar en inglés" (p. ej. pasar a Conversación libre). */
  alPlaticar?: () => void;
}

/**
 * La tutora habla primero. El saludo se muestra con sus botones hasta que la
 * persona escribe o toca uno; entonces queda en la conversación como un
 * mensaje más (solo en pantalla) y los botones se van.
 */
export function useSaludoTutora(o: Opciones) {
  const [saludo, setSaludo] = useState<string | null>(o.inicial);

  /** El saludo pasa a ser un mensaje normal, seguido de `extra`. */
  function fijar(extra: ChatMsg[] = []) {
    if (!saludo && extra.length === 0) return;
    o.agregarLocales([...(saludo ? [{ role: "assistant" as const, content: saludo }] : []), ...extra], extra.length > 0);
    setSaludo(null);
  }

  function tocar(boton: BotonRapido) {
    registrarEvento("boton_rapido", boton);
    const contestar = (respuestas: string[]) =>
      fijar([
        { role: "user", content: ETIQUETA_BOTON[boton] },
        { role: "assistant", content: alAzar(respuestas) },
      ]);

    if (boton === "pronunciacion") {
      setSaludo(null);
      o.abrirPronunciacion();
    } else if (boton === "reto") {
      setSaludo(null);
      o.abrirReto?.();
    } else if (boton === "platicar") {
      o.alPlaticar?.();
      contestar(RESPUESTAS_PLATICAR);
    } else {
      o.ponerPrincipiante?.();
      contestar(RESPUESTAS_PRINCIPIANTE);
    }
  }

  return { saludo, fijar, tocar };
}
