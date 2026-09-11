"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, Loader2 } from "lucide-react";

interface GoLiveProgramaButtonProps {
  programaId: string;
  nombre: string;
}

export function GoLiveProgramaButton({ programaId, nombre }: GoLiveProgramaButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function irEnVivo() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platikas/create-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nombre, programa_id: programaId }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error ?? "No se pudo iniciar el programa");
      router.push(`/platikas/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar el programa");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        onClick={irEnVivo}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: "var(--color-primary)", color: "#000", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
        Ir en vivo
      </button>
      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
