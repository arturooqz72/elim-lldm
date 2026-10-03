// src/components/juegos/palabra/CuentaRegresiva.tsx
"use client";

import { useEffect, useState } from "react";
import { msHastaSiguienteDia } from "@/lib/palabra/logica";

function formatear(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Tiempo hasta la siguiente palabra; al llegar a cero recarga para mostrarla. */
export function CuentaRegresiva() {
  // null en el render del servidor: la hora real solo se calcula en el
  // cliente después de montar, para no causar un hydration mismatch.
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    const actualizar = () => {
      const ms = msHastaSiguienteDia();
      setRestante(ms);
      if (ms <= 0) window.location.reload();
    };
    actualizar();
    const id = window.setInterval(actualizar, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="font-mono tabular-nums" suppressHydrationWarning>
      {restante === null ? "--:--:--" : formatear(restante)}
    </span>
  );
}
