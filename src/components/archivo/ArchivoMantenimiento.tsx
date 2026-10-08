import Link from "next/link";
import { Radio, Wrench } from "lucide-react";

/** Aviso de /archivo mientras ARCHIVO_MAINTENANCE="true" (mismo encabezado que la página normal). */
export function ArchivoMantenimiento() {
  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div
        className="py-12 px-4"
        style={{
          background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
            Archivo
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>Pláticas grabadas de la fe LLDM — siempre disponibles</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <div
          className="max-w-xl mx-auto rounded-2xl p-6 flex flex-col items-center text-center gap-4"
          style={{ background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.3)" }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(212,160,23,0.12)" }}
          >
            <Wrench size={22} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              El Archivo está en mantenimiento
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
              Muy pronto encontrarás aquí las pláticas grabadas. Mientras tanto, puedes escuchar la Radio en vivo.
            </p>
          </div>
          <Link
            href="/radio"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Radio size={15} />
            Escuchar la Radio
          </Link>
        </div>
      </div>
    </div>
  );
}
