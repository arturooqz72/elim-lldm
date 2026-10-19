// src/components/layout/AvisoRedes.tsx
//
// Aviso pequeño de la portada: "Síguenos en Instagram y TikTok: @elimlldm".
// Cada nombre abre su cuenta en una pestaña nueva.
import { Fragment } from "react";
import { REDES, REDES_USUARIO } from "@/lib/redes";
import { IconoRed } from "./IconosRedes";

export function AvisoRedes() {
  return (
    <p
      className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm"
      style={{
        background: "rgba(212,160,23,0.08)",
        border: "1px solid rgba(212,160,23,0.25)",
        color: "var(--color-text-muted)",
      }}
    >
      <span>Síguenos en</span>
      {REDES.map((r, i) => (
        <Fragment key={r.id}>
          {i > 0 && <span>y</span>}
          {/* "TikTok: @elimlldm" siempre juntos (no se parten en el celular). */}
          <span className="inline-flex items-center">
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold hover:underline"
              style={{ color: "var(--color-primary)" }}
            >
              <IconoRed id={r.id} size={14} />
              {r.nombre}
            </a>
            {i === REDES.length - 1 && (
              <>
                :
                <span className="ml-1.5 font-semibold" style={{ color: "var(--color-text)" }}>
                  {REDES_USUARIO}
                </span>
              </>
            )}
          </span>
        </Fragment>
      ))}
    </p>
  );
}
