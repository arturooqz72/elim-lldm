// src/app/admin/en-linea/page.tsx
import { Activity } from "lucide-react";
import { EnLineaAhora } from "@/components/admin/EnLineaAhora";

export const metadata = { title: "En línea ahora — Admin" };

// El layout de /admin ya exige rol admin; los datos llegan en vivo por
// Supabase Realtime desde el navegador (canal presence:site).
export default function EnLineaPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Activity size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          En línea ahora
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        Quién está en elimlldm.net en este momento y en qué página. Los oyentes que solo escuchan la radio desde
        otra app se ven en AzuraCast.
      </p>
      <EnLineaAhora />
    </div>
  );
}
