"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteSaludoButton({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`¿Borrar el saludo de "${nombre}"? Esta acción no se puede deshacer.`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/saludos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Error al borrar" }));
        window.alert(error ?? "Error al borrar");
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Error al borrar el saludo.");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0"
      style={{ background: "var(--color-destructive)", color: "#000" }}
    >
      {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      {deleting ? "Borrando…" : "Borrar"}
    </button>
  );
}
