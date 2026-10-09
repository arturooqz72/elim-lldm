"use client";

import { useFormStatus } from "react-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { revisarBancoAhora } from "./acciones";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
      style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
      {pending ? "Revisando… (puede tardar unos minutos)" : "Revisar banco ahora"}
    </button>
  );
}

/** Corre a mano la revisión semanal: solo genera si el banco se está quedando corto. */
export function BotonRevisarBanco({ filtros }: { filtros: string }) {
  return (
    <form action={revisarBancoAhora}>
      <input type="hidden" name="filtros" value={filtros} />
      <Boton />
    </form>
  );
}
