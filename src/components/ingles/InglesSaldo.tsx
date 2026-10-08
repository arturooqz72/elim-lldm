import { Coins, Flame, MessageCircle } from "lucide-react";
import type { InglesRacha, InglesSaldo as Saldo } from "@/types";

const GOLD = "#f5c842";

interface Props {
  saldo: Saldo;
  /** Con la venta pausada (ENGLISH_PAYMENTS_ENABLED=false) no se muestran los créditos. */
  mostrarCreditos: boolean;
  /** Días seguidos practicando. La flama se apaga (gris) si hoy todavía no cuenta. */
  racha?: InglesRacha;
}

export function InglesSaldo({ saldo, mostrarCreditos, racha }: Props) {
  const sinGratis = saldo.gratisRestantes === 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
      <span className="flex items-center gap-1.5">
        <MessageCircle size={13} style={{ color: sinGratis ? "var(--color-destructive)" : GOLD }} />
        <strong style={{ color: "var(--color-text)" }}>{saldo.gratisRestantes}</strong> de {saldo.gratisDiarios} gratis hoy
      </span>
      {racha && (
        <span
          className="flex items-center gap-1"
          title={
            racha.hoyCuenta
              ? "Racha: días seguidos practicando. Hoy ya cuenta."
              : "Racha: completa el reto o manda 3 mensajes hoy para mantenerla."
          }
        >
          <Flame size={14} style={{ color: racha.hoyCuenta ? "#fb923c" : "var(--color-text-muted)" }} />
          <strong style={{ color: "var(--color-text)" }}>{racha.actual}</strong>
          {racha.actual === 1 ? "día" : "días"} de racha
        </span>
      )}
      {mostrarCreditos && (
        <span className="flex items-center gap-1.5">
          <Coins size={13} style={{ color: GOLD }} />
          <strong style={{ color: "var(--color-text)" }}>{saldo.creditos.toLocaleString("es-MX")}</strong> créditos
        </span>
      )}
    </div>
  );
}
