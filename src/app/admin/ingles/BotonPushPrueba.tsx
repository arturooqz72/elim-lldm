"use client";

import { useState } from "react";
import { Send } from "lucide-react";

/** Manda ya mismo un recordatorio de prueba a los teléfonos del admin (no a nadie más). */
export function BotonPushPrueba() {
  const [estado, setEstado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function mandar() {
    setOcupado(true);
    setEstado(null);
    try {
      const res = await fetch("/api/ingles/recordatorio/prueba", { method: "POST" });
      const data = (await res.json()) as { suscripciones?: number; entregados?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo mandar");
      setEstado(
        data.suscripciones
          ? `Enviada a ${data.entregados} de ${data.suscripciones} ${data.suscripciones === 1 ? "teléfono" : "teléfonos"}.`
          : "No tienes el recordatorio activado en ningún teléfono. Abre /ingles en tu teléfono, toca la campana 🔔 y vuelve a intentarlo.",
      );
    } catch (err) {
      setEstado(err instanceof Error ? err.message : "No se pudo mandar");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void mandar()}
        disabled={ocupado}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        <Send size={14} /> Mandarme una notificación de prueba
      </button>
      {estado && (
        <p className="text-xs" role="status" style={{ color: "var(--color-text-muted)" }}>
          {estado}
        </p>
      )}
    </div>
  );
}
