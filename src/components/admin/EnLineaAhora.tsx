// src/components/admin/EnLineaAhora.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { UserRound, Users } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { useConectadosSitio } from "./useConectadosSitio";
import { nombreSeccion } from "./secciones-sitio";

interface Perfil {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}

function haceCuanto(desde: string | null, ahora: number): string {
  if (!desde) return "";
  const min = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 60_000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h ${min % 60} min`;
}

/**
 * Quién está en el sitio público ahora mismo, en vivo (ver useConectadosSitio).
 * Los nombres se leen de profiles, que ya es de lectura pública.
 */
export function EnLineaAhora() {
  const { usuarios, visitantes, conectado } = useConectadosSitio();
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({});
  const [ahora, setAhora] = useState(0);

  // Nombres de quienes aún no conocemos.
  useEffect(() => {
    const faltan = usuarios.map((u) => u.id).filter((id) => !perfiles[id]);
    if (faltan.length === 0) return;
    const supabase = createFreshClient();
    void supabase
      .from("profiles")
      .select("id, display_name, avatar_url, role")
      .in("id", faltan)
      .then(({ data }) => {
        if (!data) return;
        setPerfiles((prev) => {
          const sig = { ...prev };
          for (const p of data as Perfil[]) sig[p.id] = p;
          return sig;
        });
      });
  }, [usuarios, perfiles]);

  // Reloj para "hace X min" (empieza en el cliente para no romper la hidratación).
  useEffect(() => {
    setAhora(Date.now());
    const id = window.setInterval(() => setAhora(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const porSeccion = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const u of usuarios) for (const r of u.rutas.length ? u.rutas : [""]) {
      const s = nombreSeccion(r || undefined);
      cuenta.set(s, (cuenta.get(s) ?? 0) + 1);
    }
    for (const v of visitantes) {
      const s = nombreSeccion(v.ruta);
      cuenta.set(s, (cuenta.get(s) ?? 0) + 1);
    }
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  }, [usuarios, visitantes]);

  const ordenados = [...usuarios].sort((a, b) =>
    (perfiles[a.id]?.display_name ?? "").localeCompare(perfiles[b.id]?.display_name ?? "", "es")
  );

  const tarjeta = { background: "var(--color-surface)", border: "1px solid var(--color-border)" } as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { etiqueta: "Total en el sitio", valor: usuarios.length + visitantes.length, color: "var(--color-success)" },
          { etiqueta: "Con sesión", valor: usuarios.length, color: "var(--color-primary)" },
          { etiqueta: "Visitantes sin cuenta", valor: visitantes.length, color: "var(--color-info)" },
        ].map((c) => (
          <div key={c.etiqueta} className="p-4 rounded-2xl" style={tarjeta}>
            <p className="text-3xl font-bold" style={{ color: c.color }}>
              {c.valor}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {c.etiqueta}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: conectado ? "var(--color-success)" : "var(--color-text-muted)" }}
        />
        {conectado ? "En vivo — se actualiza solo" : "Conectando…"} · cuenta cada pestaña abierta de visitantes sin
        cuenta; cada usuario con sesión cuenta una vez.
      </p>

      {porSeccion.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {porSeccion.map(([seccion, n]) => (
            <span
              key={seccion}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(212,160,23,0.1)", color: "var(--color-primary)" }}
            >
              {seccion}: {n}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={tarjeta}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <Users size={14} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Usuarios con sesión ({usuarios.length})
          </span>
        </div>
        {ordenados.length === 0 ? (
          <p className="text-sm text-center px-4 py-8" style={{ color: "var(--color-text-muted)" }}>
            {conectado ? "Nadie con sesión iniciada está en el sitio ahora mismo." : "Conectando…"}
          </p>
        ) : (
          <ul className="p-3 flex flex-col gap-1.5">
            {ordenados.map((u) => {
              const p = perfiles[u.id];
              return (
                <li
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: "var(--color-surface-elevated)" }}
                >
                  {p?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
                    >
                      <UserRound size={15} />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                      {p?.display_name ?? "Cargando…"}
                      {p && p.role !== "participante" && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                          {p.role}
                        </span>
                      )}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                      {u.rutas.length ? u.rutas.map((r) => nombreSeccion(r)).join(" · ") : "Sitio"}
                    </p>
                  </div>
                  <span className="text-[11px] shrink-0" style={{ color: "var(--color-text-muted)" }}>
                    {ahora ? haceCuanto(u.desde, ahora) : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
