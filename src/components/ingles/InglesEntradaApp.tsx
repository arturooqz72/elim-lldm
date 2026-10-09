"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InglesCodigo } from "./InglesCodigo";
import { plataforma } from "./instalacionApp";

const GOLD = "#f5c842";

interface Props {
  gratisDiarios: number;
  /** false si la prueba sin cuenta ya se terminó en este teléfono. */
  puedeProbar: boolean;
  onProbar: () => void;
}

/**
 * Primera pantalla de la app instalada cuando no hay sesión: iniciar sesión
 * (con código por correo, que funciona dentro de la app) o probar sin cuenta.
 */
export function InglesEntradaApp({ gratisDiarios, puedeProbar, onProbar }: Props) {
  const [conCodigo, setConCodigo] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => setIos(plataforma() === "ios"), []);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-8 flex flex-col items-center text-center gap-5">
      <div className="text-4xl" aria-hidden>
        🎓
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold leading-tight" style={{ color: "var(--color-text)" }}>
          Inicia sesión para seguir practicando
        </h2>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Con tu cuenta tienes {gratisDiarios} mensajes gratis cada día, tu historial, tu racha y la práctica de
          pronunciación con voz.
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        {conCodigo ? (
          <InglesCodigo />
        ) : (
          <button
            type="button"
            onClick={() => setConCodigo(true)}
            className="w-full py-3.5 rounded-xl text-base font-bold"
            style={{ background: GOLD, color: "#000" }}
          >
            Iniciar sesión
          </button>
        )}
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {conCodigo ? "Te mandamos un código a tu correo; no necesitas contraseña. " : ""}
          ¿Prefieres contraseña o Google?{" "}
          <Link href="/login?returnUrl=%2Fingles" className="underline" style={{ color: "var(--color-text)" }}>
            Entrar de otra forma
          </Link>
          {ios && " (en iPhone puede abrirse Safari; si no regresas con tu sesión, usa el código)"}
        </p>
      </div>

      {puedeProbar && (
        <div className="w-full max-w-sm flex flex-col items-center gap-3 mt-1">
          <div className="w-full flex items-center gap-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <span className="flex-1 h-px" style={{ background: "var(--color-border)" }} />o
            <span className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
          </div>
          <button
            type="button"
            onClick={onProbar}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ border: `1px solid ${GOLD}66`, color: GOLD }}
          >
            Pruébala sin cuenta (3 mensajes)
          </button>
        </div>
      )}
    </div>
  );
}
