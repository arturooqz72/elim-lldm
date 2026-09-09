import Link from "next/link";

export function PublicFooter() {
  return (
    <footer
      className="mt-auto py-8 px-4"
      style={{
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <span
            className="text-lg font-bold tracking-widest"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
          >
            Elim LLDM
          </span>
          <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
            Predicando la Fe al Mundo
          </span>
        </div>

        {/* flex-wrap + justify-center: en pantallas angostas 6 links en una
            sola fila (uno bastante largo, "Saludos para la radio en audio")
            se salían del ancho de la pantalla y el último quedaba cortado
            en el borde. Ahora bajan a la siguiente línea en vez de desbordar. */}
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {[
            { href: "/radio", label: "Radio" },
            { href: "/platikas", label: "Estudio en Vivo" },
            { href: "/juegos", label: "Juegos" },
            { href: "/archivo", label: "Archivo" },
            { href: "/contacto", label: "Contáctanos" },
            { href: "/saludo", label: "Saludos para la radio en audio" },
          ].map(({ href, label }) => {
            const isSaludo = href === "/saludo";
            return (
              <Link
                key={href}
                href={href}
                className="text-sm transition-colors"
                style={{
                  color: isSaludo ? "var(--color-primary)" : "var(--color-text-muted)",
                  fontWeight: isSaludo ? 700 : 400,
                  textShadow: isSaludo ? "0 0 14px rgba(212,160,23,0.55)" : "none",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <p style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
          © {new Date().getFullYear()} Elim LLDM
        </p>
      </div>
    </footer>
  );
}
