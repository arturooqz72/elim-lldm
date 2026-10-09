"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Trash2, Gamepad2, Bell } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { getNotificationPermission, isPushSupported, subscribeToPush } from "@/lib/push/subscribe";

const NOMBRE_MAX = 120;
const WHATSAPP_MAX = 40;

type Status = "idle" | "saving" | "removing";
type Avisos = "no_soportado" | "inactivos" | "activando" | "activos";

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

export function JugadoresEnLineaForm({
  userId,
  registrado,
}: {
  userId: string;
  registrado: { nombre: string; whatsapp: string } | null;
}) {
  const [nombre, setNombre] = useState(registrado?.nombre ?? "");
  const [whatsapp, setWhatsapp] = useState(registrado?.whatsapp ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [isRegistrado, setIsRegistrado] = useState(Boolean(registrado));
  // "no_soportado" en el primer render (igual que en el servidor) para no
  // provocar un hydration mismatch; se corrige al montar.
  const [avisos, setAvisos] = useState<Avisos>("no_soportado");
  const [avisoError, setAvisoError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!isPushSupported()) return;
    if (getNotificationPermission() === "granted") {
      // Con el permiso ya dado no aparece ninguna ventana: solo se asegura
      // de que el servidor tenga la suscripción de este navegador.
      setAvisos("activos");
      void subscribeToPush().catch(() => setAvisos("inactivos"));
    } else {
      setAvisos("inactivos");
    }
  }, []);

  const nombreOk = nombre.trim().length > 0 && nombre.trim().length <= NOMBRE_MAX;
  const whatsappTexto = whatsapp.trim();
  // El WhatsApp es opcional: ya no se usa para invitar, solo lo ven los admin.
  const whatsappOk = whatsappTexto === "" || (whatsappTexto.length >= 7 && whatsappTexto.length <= WHATSAPP_MAX);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!nombreOk || !whatsappOk) {
      setError("Escribe tu nombre. Si pones WhatsApp, que sea un número válido con código de país.");
      return;
    }

    setStatus("saving");
    const supabase = createFreshClient();
    const { error: upsertError } = await supabase
      .from("jugadores_en_linea")
      .upsert(
        { user_id: userId, nombre: nombre.trim(), whatsapp: whatsappTexto || null },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      setStatus("idle");
      setError("No pudimos guardar tu registro. Intenta de nuevo en unos minutos.");
      return;
    }

    setStatus("idle");
    setIsRegistrado(true);
    router.refresh();
  }

  async function handleRemove() {
    setStatus("removing");
    setError("");
    const supabase = createFreshClient();
    const { error: deleteError } = await supabase
      .from("jugadores_en_linea")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      setStatus("idle");
      setError("No pudimos quitarte de la lista. Intenta de nuevo.");
      return;
    }

    setStatus("idle");
    setIsRegistrado(false);
    router.refresh();
  }

  async function activarAvisos() {
    setAvisoError("");
    setAvisos("activando");
    try {
      await subscribeToPush();
      setAvisos("activos");
    } catch (err) {
      setAvisos("inactivos");
      setAvisoError(err instanceof Error ? err.message : "No se pudieron activar las notificaciones.");
    }
  }

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.25)" }}
        >
          <Gamepad2 size={18} style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
            {isRegistrado ? "Estás en la lista de jugadores" : "Avísenme cuando haya un juego"}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Quien abra una sala te podrá invitar con un aviso aquí en el sitio y una notificación en tu teléfono.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={NOMBRE_MAX}
          placeholder="Tu nombre"
          disabled={status !== "idle"}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={inputStyle}
        />
        <div className="flex flex-col gap-1">
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            maxLength={WHATSAPP_MAX}
            placeholder="WhatsApp (opcional), ej. +504 9999 9999"
            disabled={status !== "idle"}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          />
          <p className="text-xs px-1" style={{ color: "var(--color-text-muted)" }}>
            Opcional. Solo lo ven los administradores; los demás jugadores nunca ven tu número.
          </p>
        </div>

        {error && (
          <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={status !== "idle"}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {status === "saving" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {isRegistrado ? "Actualizar" : "Sumarme a la lista"}
          </button>

          {isRegistrado && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={status !== "idle"}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              {status === "removing" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Quitarme
            </button>
          )}
        </div>
      </form>

      {isRegistrado && avisos !== "no_soportado" && (
        <div className="flex flex-col gap-1">
          {avisos === "activos" ? (
            <p className="flex items-center gap-2 text-xs" style={{ color: "var(--color-success)" }}>
              <Bell size={14} />
              Notificaciones activadas en este dispositivo: te llegarán las invitaciones.
            </p>
          ) : (
            <button
              type="button"
              onClick={activarAvisos}
              disabled={avisos === "activando"}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              {avisos === "activando" ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
              Recibir invitaciones como notificación
            </button>
          )}
          {avisoError && (
            <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{avisoError}</p>
          )}
        </div>
      )}
    </div>
  );
}
