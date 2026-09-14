import { Hammer } from "lucide-react";

// Se muestra en vez del Estudio en Vivo mientras se reconstruye —
// visible para cualquiera que no sea administrador (ver /platikas y
// /platikas/[id]). Quitar una vez que el estudio esté listo de nuevo.
export function UnderConstruction() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        className="flex flex-col items-center text-center gap-4 max-w-md py-16 px-8 rounded-2xl"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.2)" }}
        >
          <Hammer size={32} style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <p className="text-xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
            Estudio en Vivo en construcción
          </p>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Estamos mejorando esta sección. Vuelve a intentarlo pronto.
          </p>
        </div>
      </div>
    </div>
  );
}
