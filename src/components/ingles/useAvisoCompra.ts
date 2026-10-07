"use client";

import { useEffect, useState } from "react";
import type { InglesSaldo } from "@/types";

/**
 * Aviso al volver de Stripe Checkout (?compra=ok|cancelada). Quita el
 * parámetro de la URL y, si se pagó, consulta el saldo hasta que el webhook
 * acredite los créditos (normalmente tarda unos segundos).
 */
export function useAvisoCompra(
  compra: "ok" | "cancelada" | null,
  creditosIniciales: number,
  onCreditos: (saldo: InglesSaldo) => void,
) {
  const [aviso, setAviso] = useState<string | null>(
    compra === "ok"
      ? "¡Gracias por tu compra! Tus créditos aparecerán en unos segundos."
      : compra === "cancelada"
        ? "El pago se canceló; no se hizo ningún cargo."
        : null,
  );

  useEffect(() => {
    if (!compra) return;
    window.history.replaceState(null, "", "/ingles");
    if (compra !== "ok") return;

    let intentos = 0;
    const timer = setInterval(async () => {
      intentos++;
      const res = await fetch("/api/ingles/saldo").catch(() => null);
      const nuevo = res?.ok ? ((await res.json()) as InglesSaldo) : null;
      if (nuevo && nuevo.creditos > creditosIniciales) {
        onCreditos(nuevo);
        setAviso(`¡Listo! Se agregaron tus créditos. Ahora tienes ${nuevo.creditos.toLocaleString("es-MX")}.`);
        clearInterval(timer);
      } else if (intentos >= 15) {
        setAviso("Tu pago se recibió. Si tus créditos no aparecen en unos minutos, recarga la página o escríbenos.");
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
    // onCreditos cambia en cada render; solo se arranca una vez por regreso de Stripe.
  }, [compra, creditosIniciales]);

  return aviso;
}
