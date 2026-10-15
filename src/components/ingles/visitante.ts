"use client";

const CLAVE_VISITANTE = "elim-visitante-id"; // el mismo id anónimo que usa el historial de visitas

/** Mismo criterio que useRegistrarVisita: si todavía no existe, se crea. */
export function idVisitante(): string | null {
  try {
    let id = localStorage.getItem(CLAVE_VISITANTE);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLAVE_VISITANTE, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Guarda un evento para /admin/ingles (botón rápido que tocó, respuesta al
 * aviso de recordatorios). Solo estadísticas: si falla, no pasa nada.
 */
export function registrarEvento(tipo: "boton_rapido" | "aviso_push", valor: string) {
  void fetch("/api/ingles/evento", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tipo, valor, visitante: idVisitante() }),
    keepalive: true,
  }).catch(() => {});
}
