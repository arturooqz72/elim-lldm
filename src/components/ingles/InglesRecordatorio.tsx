"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { GuiaIphone } from "./GuiaIphone";
import { activarRecordatorio, apagarRecordatorio, useEstadoRecordatorio } from "./recordatorio";
import { registrarEvento } from "./visitante";

const GOLD = "#f5c842";
/** localStorage: cuándo tocó "Ahora no" (el aviso no vuelve a salir en unos días). */
const CLAVE_POSPUESTO = "elim-english-recordatorio-pospuesto";
const DIAS_POSPUESTO = 3;
const INTRO_IPHONE =
  "En iPhone, los recordatorios solo funcionan si Elim English está en tu pantalla de inicio (iOS 16.4 o más nuevo). Después ábrela desde ahí y toca la campana 🔔.";

function pospuesto(): boolean {
  try {
    const cuando = Number(localStorage.getItem(CLAVE_POSPUESTO));
    return Boolean(cuando) && Date.now() - cuando < DIAS_POSPUESTO * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * Aviso propio antes del permiso del navegador: "¿Quieres que te recuerde…?".
 * Sale en el chat después de su primera respuesta de la tutora (o del reto),
 * nunca al entrar. En iPhone sin la app instalada explica cómo instalarla.
 */
export function InglesAvisoRecordatorio({ mostrar }: { mostrar: boolean }) {
  const estado = useEstadoRecordatorio();
  const [cerrado, setCerrado] = useState(true);
  const [guia, setGuia] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    setCerrado(pospuesto());
  }, []);

  if (mensaje) {
    return (
      <p className="text-xs text-center" role="status" style={{ color: "var(--color-text-muted)" }}>
        {mensaje}
      </p>
    );
  }
  if (!mostrar || cerrado || (estado !== "inactivo" && estado !== "iphone_sin_app")) return null;

  function ahoraNo() {
    try {
      localStorage.setItem(CLAVE_POSPUESTO, String(Date.now()));
    } catch {
      // sin localStorage vuelve a salir la próxima vez; no pasa nada
    }
    registrarEvento("aviso_push", "ahora_no");
    setCerrado(true);
  }

  async function si() {
    if (estado === "iphone_sin_app") {
      registrarEvento("aviso_push", "si");
      setGuia(true);
      return;
    }
    const r = await activarRecordatorio();
    registrarEvento("aviso_push", r === "activo" ? "si" : "bloqueado");
    setMensaje(
      r === "activo"
        ? "🔔 ¡Listo! Te recuerdo tu reto cada tarde, solo si ese día no has practicado. Puedes apagarlo con la campana de arriba."
        : r === "bloqueado"
          ? "Tu navegador no dio permiso para las notificaciones. Puedes activarlas en la configuración del sitio y tocar la campana 🔔 de arriba."
          : "No se pudo activar el recordatorio. Inténtalo más tarde con la campana 🔔 de arriba.",
    );
  }

  return (
    <>
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{ background: `${GOLD}0F`, border: `1px solid ${GOLD}55` }}
        role="region"
        aria-label="Recordatorio diario"
      >
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          ¿Quieres que te recuerde tu reto diario de inglés? 🔔
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void si()}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: GOLD, color: "#000" }}
          >
            Sí, recuérdame
          </button>
          <button
            type="button"
            onClick={ahoraNo}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            Ahora no
          </button>
        </div>
      </div>
      {guia && (
        <GuiaIphone
          titulo="Recordatorios en iPhone"
          intro={INTRO_IPHONE}
          onCerrar={() => {
            setGuia(false);
            setCerrado(true);
          }}
        />
      )}
    </>
  );
}

/** Campana del encabezado: prende o apaga el recordatorio en este teléfono. */
export function InglesCampana() {
  const estado = useEstadoRecordatorio();
  const [guia, setGuia] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!nota) return;
    const t = window.setTimeout(() => setNota(null), 5000);
    return () => window.clearTimeout(t);
  }, [nota]);

  if (estado === "cargando" || estado === "no_soportado") return null;
  const activo = estado === "activo";

  async function tocar() {
    if (ocupado) return;
    if (estado === "iphone_sin_app") return setGuia(true);
    if (estado === "bloqueado") {
      return setNota("Las notificaciones están bloqueadas. Actívalas en la configuración del sitio de tu navegador.");
    }
    setOcupado(true);
    try {
      if (activo) {
        await apagarRecordatorio();
        registrarEvento("aviso_push", "apagado");
        setNota("Recordatorio apagado.");
      } else {
        const r = await activarRecordatorio();
        registrarEvento("aviso_push", r === "activo" ? "si" : "bloqueado");
        setNota(r === "activo" ? "🔔 Recordatorio activado." : "No se pudo activar. Revisa el permiso de notificaciones.");
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => void tocar()}
        className="p-2 rounded-lg transition-colors"
        style={{ color: activo ? GOLD : "var(--color-text-muted)", opacity: ocupado ? 0.5 : 1 }}
        title={activo ? "Recordatorio diario activado (tocar para apagar)" : "Activar recordatorio diario"}
        aria-label={activo ? "Apagar recordatorio diario" : "Activar recordatorio diario"}
        aria-pressed={activo}
      >
        {activo ? <Bell size={16} fill="currentColor" /> : <BellOff size={16} />}
      </button>
      {nota && (
        <p
          className="absolute right-0 top-full mt-1 w-56 z-30 rounded-xl px-3 py-2 text-xs shadow-lg"
          role="status"
          style={{ background: "var(--color-surface-elevated)", border: `1px solid ${GOLD}55`, color: "var(--color-text)" }}
        >
          {nota}
        </p>
      )}
      {guia && <GuiaIphone titulo="Recordatorios en iPhone" intro={INTRO_IPHONE} onCerrar={() => setGuia(false)} />}
    </div>
  );
}
