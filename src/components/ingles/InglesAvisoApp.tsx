"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { abiertaComoApp, plataforma } from "./instalacionApp";

const GOLD = "#f5c842";

/**
 * Solo en la app instalada y sin sesión: avisa a quien ya tiene cuenta que
 * inicie sesión aquí. En iPhone la app no comparte la sesión con Safari, así
 * que alguien que ya usaba la tutora llega a la prueba sin cuenta y su uso
 * no queda en su cuenta. La prueba sigue disponible debajo.
 */
export function InglesAvisoApp({ gratisDiarios }: { gratisDiarios: number }) {
  // Se decide en el cliente: el servidor no sabe si es la app instalada.
  const [ios, setIos] = useState<boolean | null>(null);

  useEffect(() => {
    if (abiertaComoApp()) setIos(plataforma() === "ios");
  }, []);

  if (ios === null) return null;

  return (
    <div
      className="px-5 py-2.5 shrink-0 flex items-center gap-3"
      style={{ background: `${GOLD}0F`, borderBottom: `1px solid ${GOLD}33` }}
    >
      <p className="flex-1 text-xs leading-snug" style={{ color: "var(--color-text)" }}>
        <strong>¿Ya tienes cuenta?</strong>{" "}
        {ios
          ? "La app no comparte la sesión con Safari: inicia sesión una vez aquí"
          : "Inicia sesión aquí"}{" "}
        para seguir con tus {gratisDiarios} mensajes diarios y tu historial.
      </p>
      <Link
        href="/login?returnUrl=%2Fingles"
        className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold"
        style={{ background: GOLD, color: "#000" }}
      >
        Iniciar sesión
      </Link>
    </div>
  );
}
