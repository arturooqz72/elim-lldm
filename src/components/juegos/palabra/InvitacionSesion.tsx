// src/components/juegos/palabra/InvitacionSesion.tsx
import Link from "next/link";
import { LogIn } from "lucide-react";

export function InvitacionSesion() {
  return (
    <div
      className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl text-center sm:text-left"
      style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.3)" }}
    >
      <p className="flex-1 text-sm" style={{ color: "var(--color-text)" }}>
        <strong>Inicia sesión para no perder tu racha</strong> y aparecer en el ranking. Tu progreso
        de este dispositivo se guarda en tu cuenta.
      </p>
      <Link
        href="/login?returnUrl=/juegos/palabra"
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        <LogIn size={16} />
        Iniciar sesión
      </Link>
    </div>
  );
}
