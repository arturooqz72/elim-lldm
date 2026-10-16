// src/app/admin/palabra/tiktok/page.tsx
// Video de TikTok de la Palabra del Día (solo admin, lo revisa
// admin/layout.tsx). Solo días ya terminados (por defecto ayer): nunca
// muestra la palabra del día en curso aunque pidan esa fecha en la URL.
import Link from "next/link";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { esFechaIso, sumarDias } from "@/lib/palabra/logica";
import { PALABRA_EPOCH } from "@/lib/palabra/config";
import { fechaDeHoy } from "@/lib/palabra/servidor";
import { getTarjetaTikTok } from "@/lib/palabra/puntos.server";
import { TarjetaTikTok } from "@/components/admin/TarjetaTikTok";

export const metadata = { title: "Video TikTok — Palabra del Día" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ fecha?: string }>;
}

export default async function VideoTikTokPage({ searchParams }: Props) {
  const { fecha: pedida } = await searchParams;
  const ayer = sumarDias(fechaDeHoy(), -1);
  const valida = esFechaIso(pedida) && pedida <= ayer && pedida >= PALABRA_EPOCH;
  const fecha = valida ? pedida : ayer;
  const t = await getTarjetaTikTok(fecha);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Clapperboard size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Video para TikTok
        </h1>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Link href="/admin/palabra" className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
          <ArrowLeft size={14} /> Palabra del Día
        </Link>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Día
            <input
              type="date"
              name="fecha"
              defaultValue={fecha}
              min={PALABRA_EPOCH}
              max={ayer}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
          </label>
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--color-primary)", color: "#000" }}>
            Ver
          </button>
        </form>
      </div>

      {pedida && !valida && (
        <p className="text-sm" style={{ color: "var(--color-destructive)" }}>
          Solo se pueden ver días que ya terminaron (hasta ayer). Se muestra el de ayer.
        </p>
      )}

      <p className="text-xs max-w-xl" style={{ color: "var(--color-text-muted)" }}>
        {t.jugadores} {t.jugadores === 1 ? "persona jugó" : "personas jugaron"} este día. Gana quien la resolvió en menos
        intentos; en empate, quien la resolvió primero (día en hora del Pacífico). Quien no aceptó salir en TikTok aparece
        como “Hermano/a participante”, sin foto; los demás, con su nombre corto (“Arturo O.”).
      </p>

      <TarjetaTikTok t={t} />
    </div>
  );
}
