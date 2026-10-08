import Link from "next/link";
import { Sparkles } from "lucide-react";

const GOLD = "#f5c842";

const REGISTRO = "/login?returnUrl=%2Fingles&modo=registro";
const ENTRAR = "/login?returnUrl=%2Fingles";

interface Props {
  gratisDiarios: number;
  /** Este navegador ya pasó su prueba a una cuenta: solo falta iniciar sesión. */
  reclamado: boolean;
}

/** Aviso al terminar la prueba sin cuenta: invitar a registrarse. */
export function InglesPruebaFin({ gratisDiarios, reclamado }: Props) {
  if (reclamado) {
    return (
      <div
        className="rounded-2xl p-4 flex flex-col items-start gap-3"
        style={{ background: `${GOLD}0F`, border: `1px solid ${GOLD}55` }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Tu conversación de prueba ya está guardada en tu cuenta. Inicia sesión para seguir practicando.
        </p>
        <Link
          href={ENTRAR}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: GOLD, color: "#000" }}
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-start gap-3"
      style={{ background: `${GOLD}0F`, border: `1px solid ${GOLD}55` }}
    >
      <p className="text-sm font-semibold flex items-start gap-2" style={{ color: "var(--color-text)" }}>
        <Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: GOLD }} />
        ¿Te gustó? Crea tu cuenta gratis para seguir practicando: {gratisDiarios} mensajes cada día.
      </p>
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Esta conversación se guarda en tu cuenta para que sigas donde te quedaste.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={REGISTRO}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: GOLD, color: "#000" }}
        >
          Crear cuenta gratis
        </Link>
        <Link href={ENTRAR} className="text-sm hover:underline" style={{ color: "var(--color-text-muted)" }}>
          Ya tengo cuenta
        </Link>
      </div>
    </div>
  );
}
