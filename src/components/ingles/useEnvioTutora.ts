"use client";

import { useState } from "react";
import type { ChatMsg, RespuestaChat } from "./chatAyudas";
import type { InglesModo, InglesPerfil } from "@/types";

interface Opciones {
  perfil: InglesPerfil;
  enReto: boolean;
  limite: boolean;
  /** Justo antes de mandar (p. ej. el saludo pasa a ser un mensaje más). */
  antes: () => void;
  agregar: (m: ChatMsg, delReto: boolean, modo: InglesModo) => void;
  quitarUltimo: (delReto: boolean, modo: InglesModo) => void;
  /** Lo que devolvió el servidor (saldo, racha, avance del reto…), aunque no haya respuesta. */
  alResponder: (data: RespuestaChat) => void;
  alLimite: () => void;
}

/** Caja de texto del chat con cuenta y el envío a la tutora (chat o reto). */
export function useEnvioTutora(o: Opciones) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Envía lo escrito en la caja, o el texto de un botón de sugerencia (al chat o al reto). */
  async function enviar(directo?: string) {
    const texto = (directo ?? input).trim();
    if (o.limite) return;
    if (!texto || loading) return;
    const modo = o.perfil.modo;
    const delReto = o.enReto;
    if (!delReto) o.antes();

    setInput("");
    setError(null);
    o.agregar({ role: "user", content: texto }, delReto, modo);
    setLoading(true);

    // Si el mensaje no se procesó, se quita de la pantalla y vuelve a la caja.
    const deshacer = () => {
      o.quitarUltimo(delReto, modo);
      setInput(texto);
    };

    try {
      const res = await fetch(delReto ? "/api/ingles/reto" : "/api/ingles/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(delReto ? { message: texto, nivel: o.perfil.nivel } : { message: texto, ...o.perfil }),
      });
      const data = (await res.json()) as RespuestaChat;
      const { reply, ...resto } = data;
      o.alResponder(resto);

      if (data.estado === "limite_alcanzado") {
        deshacer();
        o.alLimite();
        return;
      }
      if (!res.ok || !reply) throw new Error(data.error ?? "Error al consultar a la tutora");

      o.agregar({ id: data.mensajeId ?? undefined, role: "assistant", content: reply }, delReto, modo);
      o.alResponder({ reply });
    } catch (err) {
      deshacer();
      setError(err instanceof Error ? err.message : "Error al consultar a la tutora");
    } finally {
      setLoading(false);
    }
  }

  return { input, setInput, loading, error, setError, enviar };
}
