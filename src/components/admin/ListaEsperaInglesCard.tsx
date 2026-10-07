import { BellRing } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { pagosActivos } from "@/lib/ingles/config";

const COLOR = "#f5c842";

/**
 * Tarjeta del dashboard admin: cuántas personas pidieron que se les avise
 * cuando haya más mensajes en Elim English (tabla english_lista_espera).
 * Server Component; el layout de /admin ya exige rol admin.
 */
export async function ListaEsperaInglesCard() {
  const supabase = await createServiceClient();
  const { count } = await supabase.from("english_lista_espera").select("user_id", { count: "exact", head: true });

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${COLOR}20` }}>
        <BellRing size={18} style={{ color: COLOR }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          {count ?? 0}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          Lista de espera Elim English
        </p>
        <p className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)" }}>
          Compras {pagosActivos() ? "activas" : "pausadas"}
        </p>
      </div>
    </div>
  );
}
