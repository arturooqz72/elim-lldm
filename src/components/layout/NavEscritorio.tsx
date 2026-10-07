"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { LiveBadge } from "./LiveBadge";
import { NAV_LINKS, esActivo } from "./navLinks";

/**
 * Etiqueta de "Elim IA" cuando está en mantenimiento (ELIM_IA_MAINTENANCE).
 * En escritorio va debajo del enlace (absoluta) para no ensanchar el menú;
 * en el menú móvil va al lado del nombre.
 */
export function EtiquetaMantenimiento({ debajo = false }: { debajo?: boolean }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold leading-none whitespace-nowrap ${
        debajo ? "absolute left-1/2 -translate-x-1/2 -bottom-1.5 pointer-events-none" : ""
      }`}
      style={{ background: "rgba(144,144,168,0.15)", color: "var(--color-text-muted)" }}
    >
      En mantenimiento
    </span>
  );
}

interface Props {
  pathname: string;
  elimIaMantenimiento: boolean;
}

/** Menú de escritorio: enlaces principales a la vista y el resto en "Más ▾". */
export function NavEscritorio({ pathname, elimIaMantenimiento }: Props) {
  const [masAbierto, setMasAbierto] = useState(false);
  const masRef = useRef<HTMLDivElement>(null);
  const principales = NAV_LINKS.filter((l) => !l.enMas);
  const enMas = NAV_LINKS.filter((l) => l.enMas);
  const masActivo = enMas.some((l) => esActivo(pathname, l.href));

  // Se cierra al navegar, al hacer clic fuera o con Escape.
  useEffect(() => setMasAbierto(false), [pathname]);
  useEffect(() => {
    if (!masAbierto) return;
    const fuera = (e: MouseEvent) => {
      if (!masRef.current?.contains(e.target as Node)) setMasAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setMasAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [masAbierto]);

  return (
    // Desde xl (1280px); los íconos solo desde 2xl, donde el encabezado se
    // ensancha. Con íconos en 1280px no cabía junto a Panel Admin + "EN VIVO".
    <nav className="hidden xl:flex items-center gap-0.5">
      {principales.map(({ href, label, icon: Icon }) => {
        const active = esActivo(pathname, href);
        const isSaludo = href === "/saludo";
        return (
          <Fragment key={href}>
            <Link
              href={href}
              className="relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm whitespace-nowrap transition-all duration-200"
              style={{
                color: isSaludo || active ? "var(--color-primary)" : "var(--color-text-muted)",
                background: active ? "rgba(212,160,23,0.1)" : "transparent",
                fontWeight: isSaludo ? 700 : 500,
                textShadow: isSaludo ? "0 0 14px rgba(212,160,23,0.55)" : "none",
              }}
            >
              <Icon size={15} className="hidden 2xl:block" />
              {label}
              {href === "/elim-ia" && elimIaMantenimiento && <EtiquetaMantenimiento debajo />}
            </Link>
            {href === "/platikas" && <LiveBadge />}
          </Fragment>
        );
      })}

      <div ref={masRef} className="relative">
        <button
          type="button"
          onClick={() => setMasAbierto((v) => !v)}
          aria-expanded={masAbierto}
          aria-haspopup="menu"
          className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200"
          style={{
            color: masActivo || masAbierto ? "var(--color-primary)" : "var(--color-text-muted)",
            background: masActivo ? "rgba(212,160,23,0.1)" : "transparent",
          }}
        >
          Más
          <ChevronDown size={14} className={`transition-transform ${masAbierto ? "rotate-180" : ""}`} />
        </button>

        {masAbierto && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-52 rounded-xl py-1 z-50"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {enMas.map(({ href, label, icon: Icon }) => {
              const active = esActivo(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                  style={{
                    color: active ? "var(--color-primary)" : "var(--color-text)",
                    background: active ? "rgba(212,160,23,0.1)" : "transparent",
                  }}
                  onClick={() => setMasAbierto(false)}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
