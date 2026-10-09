import Link from "next/link";

const GOLD = "#f5c842";

const contenido = (accion: string) => (
  <>
    <span className="text-base leading-none shrink-0" aria-hidden>
      🎤
    </span>
    <span className="flex-1 min-w-0 text-xs leading-snug" style={{ color: "var(--color-text)" }}>
      <strong>Practica tu pronunciación</strong>
      {/* Bajo 400px se omite para que la tarjeta quede en una línea y no le quite espacio al chat. */}
      <span className="hidden min-[400px]:block" style={{ color: "var(--color-text-muted)" }}>
        Lee en voz alta y la tutora te corrige
      </span>
    </span>
    <span
      className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
      style={{ background: GOLD, color: "#000" }}
    >
      {accion}
    </span>
  </>
);

const clase = "w-full px-3 min-[400px]:px-5 py-2 shrink-0 flex items-center gap-2.5 text-left";
const estilo = { background: `${GOLD}0F`, borderBottom: "1px solid var(--color-border)" };

/**
 * Acceso directo y visible al modo Pronunciación, arriba del chat (muchos no
 * lo encontraban entre los modos). Con cuenta cambia de modo; en la prueba
 * sin cuenta lleva a crear la cuenta, porque la voz solo es con cuenta.
 */
export function InglesPronunciacionAtajo(props: { onAbrir: () => void; accion?: string } | { href: string }) {
  if ("href" in props) {
    return (
      <Link href={props.href} className={clase} style={estilo}>
        {contenido("Crear cuenta")}
      </Link>
    );
  }
  return (
    <button type="button" onClick={props.onAbrir} className={clase} style={estilo}>
      {contenido(props.accion ?? "Probar")}
    </button>
  );
}
