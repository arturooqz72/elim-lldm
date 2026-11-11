// src/components/juegos/liga/InvitacionLiga.tsx
// Al terminar una partida SIN sesión. Solo invita; no bloquea el juego.
import Link from "next/link";
import { LogIn } from "lucide-react";

export function InvitacionLiga({ returnUrl }: { returnUrl: string }) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl text-center sm:text-left" style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.3)" }}>
      <p className="flex-1 text-sm" style={{ color: "var(--color-text)" }}>¿Quieres que tus puntos sumen para la Iglesia de tu ciudad? Entra a tu cuenta</p>
      <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
        <LogIn size={16} /> Iniciar sesión
      </Link>
    </div>
  );
}
