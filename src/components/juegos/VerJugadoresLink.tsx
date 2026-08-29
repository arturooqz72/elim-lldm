import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";

export function VerJugadoresLink() {
  return (
    <Link
      href="/juegos/jugadores"
      className="flex items-center gap-2 text-sm font-medium mb-6 transition-opacity hover:opacity-80"
      style={{ color: "#25D366" }}
    >
      <Users size={15} />
      Ver quién quiere jugar (invítalos por WhatsApp)
      <ChevronRight size={14} />
    </Link>
  );
}
