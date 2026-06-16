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

        <nav className="flex items-center gap-6">
          {[
            { href: "/radio", label: "Radio" },
            { href: "/platikas", label: "Estudio en Vivo" },
            { href: "/juegos", label: "Juegos" },
            { href: "/archivo", label: "Archivo" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              {label}
            </Link>
          ))}
        </nav>

        <p style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
          © {new Date().getFullYear()} Elim LLDM
        </p>
      </div>
    </footer>
  );
}
