"use client";

import { useState } from "react";
import { Check, Gamepad2 } from "lucide-react";
import { JUEGOS_INVITACION, type ClaveJuegoInvitacion } from "@/lib/invitaciones";

type Estado = "cerrado" | "eligiendo" | "enviando" | "enviado" | "error";

/** "Invitar a jugar" para una persona conectada (ver /api/admin/invitar). */
export function InvitarBoton({ userId }: { userId: string }) {
  const [estado, setEstado] = useState<Estado>("cerrado");

  async function invitar(juego: ClaveJuegoInvitacion) {
    setEstado("enviando");
    try {
      const res = await fetch("/api/admin/invitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, juego }),
      });
      setEstado(res.ok ? "enviado" : "error");
    } catch {
      setEstado("error");
    }
    window.setTimeout(() => setEstado("cerrado"), 3000);
  }

  const chip = "px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap";

  if (estado === "eligiendo") {
    return (
      <div className="flex flex-wrap gap-1.5 justify-end">
        {JUEGOS_INVITACION.map((j) => (
          <button
            key={j.clave}
            type="button"
            onClick={() => void invitar(j.clave)}
            className={chip}
            style={{ background: "rgba(212,160,23,0.12)", color: "var(--color-primary)" }}
          >
            {j.nombre}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEstado("cerrado")}
          className={chip}
          style={{ color: "var(--color-text-muted)" }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  if (estado === "enviado" || estado === "error" || estado === "enviando") {
    return (
      <span
        className="text-[11px] font-semibold inline-flex items-center gap-1"
        style={{ color: estado === "error" ? "var(--color-destructive)" : "var(--color-success)" }}
      >
        {estado === "enviando" ? "Enviando…" : estado === "error" ? "No se pudo enviar" : (<><Check size={12} /> Invitación enviada</>)}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEstado("eligiendo")}
      className={`${chip} inline-flex items-center gap-1`}
      style={{ background: "var(--color-primary)", color: "#000" }}
    >
      <Gamepad2 size={12} /> Invitar a jugar
    </button>
  );
}
