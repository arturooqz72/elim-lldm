import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";

export function VerJugadoresLink() {
  return (
    <Link
      href="/juegos/jugadores"
      className="flex items-center gap-2 text-sm font-medium mb-6 transition-opacity hover:opacity-80"
      style={{ color: "var(--color-primary)" }}
    >
      <Users size={15} />
      Ver quién quiere jugar e invitarlos
      <ChevronRight size={14} />
    </Link>
  );
}
