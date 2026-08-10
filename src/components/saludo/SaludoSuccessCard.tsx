import { CheckCircle2 } from "lucide-react";

export function SaludoSuccessCard({ onRecordAnother }: { onRecordAnother: () => void }) {
  return (
    <div
      className="rounded-2xl p-8 flex flex-col items-center text-center gap-3"
      style={{
        background: "var(--color-surface)",
        border: "1px solid rgba(74,222,128,0.3)",
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "rgba(74,222,128,0.12)" }}
      >
        <CheckCircle2 size={24} style={{ color: "var(--color-success)" }} />
      </div>
      <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
        ¡Gracias por tu saludo!
      </p>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Lo recibimos y podría sonar pronto en la radio.
      </p>
      <button
        onClick={onRecordAnother}
        className="mt-2 text-sm font-medium"
        style={{ color: "var(--color-primary)" }}
      >
        Grabar otro saludo
      </button>
    </div>
  );
}
