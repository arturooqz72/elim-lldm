import Link from "next/link";
import { History } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { formatoFechaHora, rangoDelDia } from "@/lib/historial";

export const metadata = { title: "Historial de visitas — Admin" };

const POR_PAGINA = 100;

interface Visita {
  id: number;
  created_at: string;
  ruta: string;
  profile_id: string | null;
  visitante_id: string | null;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

type Filtros = { q?: string; tipo?: string; dia?: string; usuario?: string; visitante?: string; pagina?: string };

const estiloCampo = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
};

/** URL de esta página conservando los filtros actuales y cambiando algunos. */
function enlace(actual: Filtros, cambios: Filtros): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...actual, ...cambios })) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/admin/historial?${qs}` : "/admin/historial";
}

// El layout de /admin ya exige rol admin; aquí se lee con service role.
export default async function HistorialPage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const filtros = await searchParams;
  const { q, tipo, dia, usuario, visitante } = filtros;
  const pagina = Math.max(1, Number(filtros.pagina) || 1);
  const supabase = await createServiceClient();

  let query = supabase
    .from("visitas_sitio")
    .select("id, created_at, ruta, profile_id, visitante_id, profiles(display_name, avatar_url)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

  if (usuario) query = query.eq("profile_id", usuario);
  if (visitante) query = query.eq("visitante_id", visitante);
  if (tipo === "usuarios") query = query.not("profile_id", "is", null);
  if (tipo === "visitantes") query = query.is("profile_id", null);

  const rango = dia ? rangoDelDia(dia) : null;
  if (rango) query = query.gte("created_at", rango.desde).lt("created_at", rango.hasta);

  if (q) {
    const { data: coincidencias } = await supabase.from("profiles").select("id").ilike("display_name", `%${q}%`);
    const ids = (coincidencias ?? []).map((p: { id: string }) => p.id);
    // Sin coincidencias: un uuid imposible para que la consulta devuelva vacío.
    query = query.in("profile_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data, count, error } = await query;
  const visitas = (data ?? []) as unknown as Visita[];
  const total = count ?? 0;
  const ultimaPagina = Math.max(1, Math.ceil(total / POR_PAGINA));
  const nombreFiltrado = usuario ? visitas[0]?.profiles?.display_name : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <History size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Historial de visitas
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        Quién entró a elimlldm.net, cuándo y qué páginas abrió. Hora del Pacífico. Se guardan los últimos 90 días.
      </p>

      <form method="GET" className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre..."
          className="flex-1 min-w-40 rounded-xl px-4 py-2.5 text-sm outline-none"
          style={estiloCampo}
        />
        <select name="tipo" defaultValue={tipo ?? ""} className="rounded-xl px-4 py-2.5 text-sm outline-none" style={estiloCampo}>
          <option value="">Todos</option>
          <option value="usuarios">Solo usuarios con cuenta</option>
          <option value="visitantes">Solo visitantes</option>
        </select>
        <input
          type="date"
          name="dia"
          defaultValue={dia}
          className="rounded-xl px-4 py-2.5 text-sm outline-none"
          style={estiloCampo}
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          Filtrar
        </button>
        {(q || tipo || dia || usuario || visitante) && (
          <Link href="/admin/historial" className="px-4 py-2.5 rounded-xl text-sm" style={estiloCampo}>
            Quitar filtros
          </Link>
        )}
      </form>

      {(usuario || visitante) && (
        <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
          Mostrando solo a{" "}
          <strong style={{ color: "var(--color-text)" }}>
            {usuario ? nombreFiltrado ?? "este usuario" : `Visitante ${visitante?.slice(0, 6)}`}
          </strong>
        </p>
      )}

      <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
        {total.toLocaleString("es-MX")} visitas
      </p>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        {error ? (
          <p className="text-center py-10 text-sm" style={{ color: "var(--color-destructive)" }}>
            No se pudo cargar el historial: {error.message}
          </p>
        ) : visitas.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: "var(--color-text-muted)" }}>
            No hay visitas con estos filtros
          </p>
        ) : (
          visitas.map((v, idx) => (
            <div
              key={v.id}
              className="flex flex-col sm:grid sm:grid-cols-[11rem_1fr_1fr] gap-1 sm:gap-4 px-5 py-3 text-sm"
              style={{ borderBottom: idx < visitas.length - 1 ? "1px solid var(--color-border)" : "none" }}
            >
              <span className="text-xs sm:text-sm" style={{ color: "var(--color-text-muted)" }}>
                {formatoFechaHora(v.created_at)}
              </span>
              {v.profile_id ? (
                <Link
                  href={enlace({}, { usuario: v.profile_id })}
                  className="truncate font-medium hover:underline"
                  style={{ color: "var(--color-text)" }}
                >
                  {v.profiles?.display_name ?? "Usuario"}
                </Link>
              ) : v.visitante_id ? (
                <Link
                  href={enlace({}, { visitante: v.visitante_id })}
                  className="truncate hover:underline"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Visitante {v.visitante_id.slice(0, 6)}
                </Link>
              ) : (
                <span style={{ color: "var(--color-text-muted)" }}>Visitante</span>
              )}
              <a
                href={v.ruta}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-xs sm:text-sm hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                {v.ruta}
              </a>
            </div>
          ))
        )}
      </div>

      {ultimaPagina > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
          {pagina > 1 ? (
            <Link href={enlace(filtros, { pagina: String(pagina - 1) })} className="hover:underline">
              ← Más recientes
            </Link>
          ) : (
            <span />
          )}
          <span>
            Página {pagina} de {ultimaPagina}
          </span>
          {pagina < ultimaPagina ? (
            <Link href={enlace(filtros, { pagina: String(pagina + 1) })} className="hover:underline">
              Más antiguas →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
