// src/components/layout/IconosRedes.tsx
//
// Íconos de Instagram y TikTok con enlace a nuestras cuentas (pestaña
// nueva). lucide-react ya no trae íconos de marcas, así que van en SVG.
import type { CSSProperties } from "react";
import { REDES, type RedSocial } from "@/lib/redes";

export function IconoRed({ id, size = 18 }: { id: RedSocial["id"]; size?: number }) {
  if (id === "instagram") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.6" cy="6.4" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 2h-3.4v13.4a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.1a6.4 6.4 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.7 1.5V6.7a4.7 4.7 0 0 1-4.7-4.7Z" />
    </svg>
  );
}

const ESTILO_BOTON: CSSProperties = {
  background: "rgba(212,160,23,0.1)",
  border: "1px solid rgba(212,160,23,0.3)",
  color: "var(--color-primary)",
};

/** Botones redondos solo con ícono (pie de página). */
export function IconosRedes({ size = 18 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      {REDES.map((r) => (
        <a
          key={r.id}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Elim LLDM en ${r.nombre}`}
          title={`Síguenos en ${r.nombre}`}
          className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 hover:shadow-[0_0_16px_rgba(212,160,23,0.35)]"
          style={ESTILO_BOTON}
        >
          <IconoRed id={r.id} size={size} />
        </a>
      ))}
    </div>
  );
}
