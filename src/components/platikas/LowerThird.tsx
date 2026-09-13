"use client";

import { useEffect, useState } from "react";

interface LowerThirdProps {
  title: string;
  subtitle: string;
}

// Banner de nombre estilo "chyron" — solo visible dentro de la app
// (no se transmite a YouTube/Facebook: LiveKit no soporta overlays
// personalizados en sus plantillas de egress, solo layouts nativos).
export function LowerThird({ title, subtitle }: LowerThirdProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 20);
    return () => clearTimeout(t);
  }, []);

  if (!title.trim()) return null;

  return (
    <div
      className="absolute bottom-24 left-4 z-10 flex items-stretch transition-all duration-300"
      style={{ opacity: shown ? 1 : 0, transform: shown ? "translateX(0)" : "translateX(-16px)" }}
    >
      <div className="w-1.5 rounded-l-md" style={{ background: "var(--color-primary)" }} />
      <div
        className="px-4 py-2 rounded-r-md backdrop-blur-md"
        style={{
          background: "rgba(10,10,18,0.85)",
          borderTop: "1px solid rgba(212,160,23,0.3)",
          borderBottom: "1px solid rgba(212,160,23,0.3)",
          borderRight: "1px solid rgba(212,160,23,0.3)",
        }}
      >
        <p className="font-bold text-sm leading-tight" style={{ color: "#fff" }}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs leading-tight" style={{ color: "var(--color-primary)" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
