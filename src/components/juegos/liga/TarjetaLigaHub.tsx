// src/components/juegos/liga/TarjetaLigaHub.tsx
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import type { FilaLiga, MiIglesiaLiga } from "@/lib/liga/consultas.server";
import { enFrase } from "@/lib/liga/nombre";

export function TarjetaLigaHub({ mia, lider }: { mia: MiIglesiaLiga | null; lider: FilaLiga | null }) {
  const linea =
    mia?.aprobada && mia.lugar
      ? `${enFrase(mia.nombre, mia.comunidad, true)}${mia.campeona ? " 🏆" : ""} va en el lugar #${mia.lugar}`
      : lider
        ? `Va ganando ${enFrase(lider.nombre, lider.comunidad)}. ¿Y tu equipo?`
        : "Todos son bienvenidos: suma puntos para tu equipo";
  return (
    <div className="relative flex items-center gap-4 p-5 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(212,160,23,0.16) 0%, var(--color-surface) 65%)", border: "1px solid rgba(212,160,23,0.5)" }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}>
        <Trophy size={20} style={{ color: "var(--color-primary)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
          <Link href="/juegos/liga" className="after:absolute after:inset-0 after:rounded-2xl">Liga de Iglesias</Link>
        </h2>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{linea}</p>
      </div>
      <ChevronRight size={18} style={{ color: "var(--color-primary)" }} />
    </div>
  );
}
