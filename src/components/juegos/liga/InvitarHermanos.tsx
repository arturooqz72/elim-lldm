// src/components/juegos/liga/InvitarHermanos.tsx
"use client";

import { MessageCircle, Share2 } from "lucide-react";
import { textoInvitacion } from "@/lib/liga/config";

export function InvitarHermanos({ equipoEnFrase }: { equipoEnFrase: string | null }) {
  const texto = textoInvitacion(equipoEnFrase);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(texto)}`;

  async function compartir() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: texto });
      } catch {
        // Canceló: no se abre nada más.
      }
      return;
    }
    window.open(whatsapp, "_blank", "noopener");
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => void compartir()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
        <Share2 size={16} /> Invitar a mis hermanos
      </button>
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Invitar por WhatsApp" className="flex items-center justify-center px-4 rounded-xl min-h-11" style={{ background: "#25D366", color: "#000" }}>
        <MessageCircle size={18} />
      </a>
    </div>
  );
}
