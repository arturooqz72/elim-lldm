import { Coins, MessageCircle } from "lucide-react";
import type { InglesSaldo as Saldo } from "@/types";

const GOLD = "#f5c842";

interface Props {
  saldo: Saldo;
  /** Con la venta pausada (ENGLISH_PAYMENTS_ENABLED=false) no se muestran los créditos. */
  mostrarCreditos: boolean;
}

export function InglesSaldo({ saldo, mostrarCreditos }: Props) {
  const sinGratis = saldo.gratisRestantes === 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
      <span className="flex items-center gap-1.5">
        <MessageCircle size={13} style={{ color: sinGratis ? "var(--color-destructive)" : GOLD }} />
        <strong style={{ color: "var(--color-text)" }}>{saldo.gratisRestantes}</strong> de {saldo.gratisDiarios} gratis hoy
      </span>
      {mostrarCreditos && (
        <span className="flex items-center gap-1.5">
          <Coins size={13} style={{ color: GOLD }} />
          <strong style={{ color: "var(--color-text)" }}>{saldo.creditos.toLocaleString("es-MX")}</strong> créditos
        </span>
      )}
    </div>
  );
}
