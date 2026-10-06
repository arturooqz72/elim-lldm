"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Send, Users } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { useConectadosSitio } from "@/components/admin/useConectadosSitio";
import { juegoInvitacion, type ClaveJuegoInvitacion } from "@/lib/invitaciones";

type Estado = "enviando" | "enviado" | "error";

/**
 * En la sala de espera de un juego: quién más tiene el sitio abierto ahora
 * mismo, con un botón para invitarlo a ESTE juego. Al invitado le aparece el
 * aviso de InvitacionJuego.tsx con "Ir a jugar", que lo trae a esta sala.
 */
export function InvitarConectados({ juego }: { juego: ClaveJuegoInvitacion }) {
  const { usuarios } = useConectadosSitio();
  const [yoId, setYoId] = useState<string | null>(null);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const rutaJuego = juegoInvitacion(juego)?.href ?? "";

  useEffect(() => {
    void createFreshClient()
      .auth.getUser()
      .then(({ data }) => setYoId(data.user?.id ?? null));
  }, []);

  const otros = useMemo(() => usuarios.filter((u) => u.id !== yoId), [usuarios, yoId]);

  // Nombres de quienes aún no conocemos (profiles es de lectura pública).
  useEffect(() => {
    const faltan = otros.map((u) => u.id).filter((id) => !nombres[id]);
    if (faltan.length === 0) return;
    void createFreshClient()
      .from("profiles")
      .select("id, display_name")
      .in("id", faltan)
      .then(({ data }) => {
        if (!data) return;
        setNombres((prev) => {
          const sig = { ...prev };
          for (const p of data as Array<{ id: string; display_name: string }>) sig[p.id] = p.display_name;
          return sig;
        });
      });
  }, [otros, nombres]);

  async function invitar(userId: string) {
    setEstados((e) => ({ ...e, [userId]: "enviando" }));
    let ok = false;
    try {
      const res = await fetch("/api/juegos/invitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, juego }),
      });
      ok = res.ok;
    } catch {
      // queda como error
    }
    setEstados((e) => ({ ...e, [userId]: ok ? "enviado" : "error" }));
  }

  if (otros.length === 0) return null;

  return (
    <div
      className="w-full max-w-sm rounded-2xl p-3 flex flex-col gap-2 text-left"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <p className="text-xs font-semibold flex items-center gap-1.5 px-1" style={{ color: "var(--color-text-muted)" }}>
        <Users size={13} />
        Conectados ahora — invítalos a esta sala
      </p>
      <ul className="flex flex-col gap-1.5">
        {otros.map((u) => {
          const yaAqui = u.rutas.some((r) => r === rutaJuego || r.startsWith(`${rutaJuego}/`));
          const estado = estados[u.id];
          return (
            <li
              key={u.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
              style={{ background: "var(--color-surface-elevated)" }}
            >
              <span className="text-sm truncate flex items-center gap-2" style={{ color: "var(--color-text)" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--color-success)" }} />
                {nombres[u.id] ?? "…"}
              </span>
              {yaAqui ? (
                <span className="text-[11px] shrink-0" style={{ color: "var(--color-text-muted)" }}>
                  Ya está aquí
                </span>
              ) : estado === "enviado" ? (
                <span className="text-[11px] font-semibold shrink-0 inline-flex items-center gap-1" style={{ color: "var(--color-success)" }}>
                  <Check size={12} /> Invitado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void invitar(u.id)}
                  disabled={estado === "enviando"}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: "var(--color-primary)", color: "#000", opacity: estado === "enviando" ? 0.6 : 1 }}
                >
                  <Send size={11} />
                  {estado === "enviando" ? "Enviando…" : estado === "error" ? "Reintentar" : "Invitar"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
