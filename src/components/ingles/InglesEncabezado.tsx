import { GraduationCap } from "lucide-react";

const GOLD = "#f5c842";

interface Props {
  subtitulo: string;
  /** Botones de la derecha (Instalar app, Entrar, Borrar conversación…). */
  children?: React.ReactNode;
  /** Separación entre los botones de la derecha en pantallas de 400px o más. */
  separacionAncha?: "gap-1" | "gap-3";
}

/**
 * Encabezado de Elim English (chat con cuenta y prueba sin cuenta). Debajo
 * de 400px usa menos margen, título de 15px y sin el círculo del birrete,
 * para que "Instalar app" quepa sin encimarse a 360, 375 y 390px.
 */
export function InglesEncabezado({ subtitulo, children, separacionAncha = "gap-3" }: Props) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-4 min-[400px]:gap-3 min-[400px]:px-5 shrink-0"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-full hidden min-[400px]:flex items-center justify-center shrink-0"
          style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}55` }}
        >
          <GraduationCap size={20} style={{ color: GOLD }} />
        </div>
        <div className="min-w-0">
          <h1
            className="text-[15px] min-[400px]:text-base font-bold whitespace-nowrap"
            style={{ color: "var(--color-text)" }}
          >
            Elim English
          </h1>
          <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
            {subtitulo}
          </p>
        </div>
      </div>
      <div
        className={`flex items-center shrink-0 ${
          separacionAncha === "gap-1" ? "gap-1" : "gap-2 min-[400px]:gap-3"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
