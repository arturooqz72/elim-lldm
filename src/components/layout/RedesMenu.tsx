// src/components/layout/RedesMenu.tsx
//
// Instagram y TikTok dentro del menú: al final de "Más ▾" en escritorio y
// en el menú del celular. Abren en una pestaña nueva.
import { REDES, REDES_USUARIO } from "@/lib/redes";
import { IconoRed } from "./IconosRedes";

interface Props {
  /** Clases de cada enlace, para que se vea igual que el resto de ese menú. */
  className: string;
  tamIcono: number;
  onClick?: () => void;
  role?: string;
}

export function RedesMenu({ className, tamIcono, onClick, role }: Props) {
  return (
    <>
      <div className="mx-3 my-1 h-px" style={{ background: "var(--color-border)" }} />
      {REDES.map((r) => (
        <a
          key={r.id}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          role={role}
          className={className}
          style={{ color: "var(--color-text)" }}
          onClick={onClick}
        >
          <span style={{ color: "var(--color-primary)" }} className="flex">
            <IconoRed id={r.id} size={tamIcono} />
          </span>
          <span className="flex-1">{r.nombre}</span>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {REDES_USUARIO}
          </span>
        </a>
      ))}
    </>
  );
}
