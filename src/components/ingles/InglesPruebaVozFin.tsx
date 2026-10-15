import Link from "next/link";

const GOLD = "#f5c842";

interface Props {
  vozDiarios: number;
  /** En la app instalada abre la pantalla de entrada; en el navegador, el enlace. */
  onCrearCuenta?: () => void;
  href: string;
}

/** Prueba sin cuenta: ya usó su intento de voz; invita a crear la cuenta. */
export function InglesPruebaVozFin({ vozDiarios, onCrearCuenta, href }: Props) {
  const clase = "px-4 py-2 rounded-xl text-sm font-semibold";
  const estilo = { background: GOLD, color: "#000" };
  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-start gap-3"
      style={{ background: `${GOLD}0F`, border: `1px solid ${GOLD}55` }}
      role="status"
    >
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        🎤 Ya usaste tu práctica de voz de la prueba. Crea tu cuenta gratis para practicar con tu voz: {vozDiarios}{" "}
        intentos al día, aparte de los mensajes.
      </p>
      {onCrearCuenta ? (
        <button type="button" onClick={onCrearCuenta} className={clase} style={estilo}>
          Crear cuenta gratis
        </button>
      ) : (
        <Link href={href} className={clase} style={estilo}>
          Crear cuenta gratis
        </Link>
      )}
    </div>
  );
}
