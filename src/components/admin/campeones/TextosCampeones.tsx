// src/components/admin/campeones/TextosCampeones.tsx
"use client";

import { useMemo } from "react";
import type { CampeonesSemana } from "@/types";
import { textoInstagram, textoTikTok, textoYouTube } from "@/lib/juegos/campeones/textos";
import { TextoTikTok } from "../TextoTikTok";

/** Los tres textos para pegar al subir el video, cada uno con su botón de copiar. */
export function TextosCampeones({ c }: { c: CampeonesSemana }) {
  const textos = useMemo(() => ({ tiktok: textoTikTok(c), instagram: textoInstagram(c), youtube: textoYouTube(c) }), [c]);
  return (
    <div className="flex flex-col gap-5">
      <TextoTikTok texto={textos.tiktok} titulo="Texto para TikTok" boton="Copiar para TikTok" filas={10} />
      <TextoTikTok texto={textos.instagram} titulo="Texto para Instagram" boton="Copiar para Instagram" filas={10} />
      <TextoTikTok texto={textos.youtube} titulo="Título y descripción para YouTube" boton="Copiar para YouTube" filas={12} />
    </div>
  );
}
