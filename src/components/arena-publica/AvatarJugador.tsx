"use client";

import { useState } from "react";

/** Foto del jugador o, si no tiene (o no carga), su inicial. */
export function AvatarJugador({ nombre, avatar, tam = 36 }: { nombre: string; avatar: string | null; tam?: number }) {
  const [fallo, setFallo] = useState(false);
  const estilo = { width: tam, height: tam } as const;
  if (avatar && !fallo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFallo(true)}
        className="rounded-full object-cover shrink-0"
        style={estilo}
      />
    );
  }
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{ ...estilo, fontSize: tam * 0.42, background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
    >
      {nombre[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
