import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { CATEGORIAS, CATEGORIA_LABEL, NIVELES, NIVEL_LABEL, esCategoria, esNivel } from "@/lib/trivia/banco";
import { PreguntaFila, type FilaPregunta } from "./PreguntaFila";
import { PreguntaFormBanco } from "./PreguntaFormBanco";
import { BotonRevisarBanco } from "./BotonRevisarBanco";

export const metadata = { title: "Banco bíblico — Admin" };
// "Revisar banco ahora" puede generar y verificar 100 preguntas.
export const maxDuration = 300;

const POR_PAGINA = 40;

const VISTAS = {
  activas: "Activas",
  pendientes: "Pendientes de revisión",
  desactivadas: "Desactivadas",
  rechazadas: "Rechazadas",
} as const;
type Vista = keyof typeof VISTAS;

const ORDENES = {
  recientes: "Más recientes",
  respondidas: "Más respondidas",
  dificiles: "Menor % de acierto",
} as const;
type Orden = keyof typeof ORDENES;

const COLUMNAS =
  "id, question_text, option_a, option_b, option_c, option_d, correct_option, bible_reference, dificultad, categoria, activa, estado, origen, veces_respondida, veces_acertada";

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function BancoPreguntasPage({ searchParams }: Props) {
  const sp = await searchParams;
  const vista: Vista = sp.vista && sp.vista in VISTAS ? (sp.vista as Vista) : "activas";
  const orden: Orden = sp.orden && sp.orden in ORDENES ? (sp.orden as Orden) : "recientes";
  const nivel = esNivel(sp.nivel) ? sp.nivel : "";
  const categoria = esCategoria(sp.categoria) ? sp.categoria : "";
  const buscar = (sp.q ?? "").trim().slice(0, 80);
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const filtrosActuales = new URLSearchParams(
    Object.entries({ vista, orden, nivel, categoria, q: buscar, pagina: String(pagina) }).filter(([, v]) => v)
  ).toString();

  // Con service role: desde 0071 la tabla solo la lee un admin, y el
  // layout de /admin ya exige ese rol.
  const service = await createServiceClient();

  const base = () =>
    service.from("questions").select("id", { count: "exact", head: true }).not("dificultad", "is", null);

  const [activasPorNivel, pendientes, desactivadas] = await Promise.all([
    Promise.all(
      NIVELES.map(async (n) => {
        const { count: c } = await base().eq("estado", "aprobada").eq("activa", true).eq("dificultad", n);
        return c ?? 0;
      })
    ),
    base().eq("estado", "pendiente").then((r) => r.count ?? 0),
    base().eq("estado", "aprobada").eq("activa", false).then((r) => r.count ?? 0),
  ]);

  let consulta = service.from("questions").select(COLUMNAS, { count: "exact" }).not("dificultad", "is", null);
  if (vista === "activas") consulta = consulta.eq("estado", "aprobada").eq("activa", true);
  if (vista === "pendientes") consulta = consulta.eq("estado", "pendiente");
  if (vista === "desactivadas") consulta = consulta.eq("estado", "aprobada").eq("activa", false);
  if (vista === "rechazadas") consulta = consulta.eq("estado", "rechazada");
  if (nivel) consulta = consulta.eq("dificultad", nivel);
  if (categoria) consulta = consulta.eq("categoria", categoria);
  if (buscar) consulta = consulta.ilike("question_text", `%${buscar.replace(/[%_]/g, "")}%`);

  if (orden === "respondidas") consulta = consulta.order("veces_respondida", { ascending: false });
  // porcentaje_acierto es una columna calculada por la base (0071).
  if (orden === "dificiles") {
    consulta = consulta
      .gt("veces_respondida", 0)
      .order("porcentaje_acierto", { ascending: true })
      .order("veces_respondida", { ascending: false });
  }
  consulta = consulta.order("created_at", { ascending: false }).order("order_index", { ascending: false });

  const desde = (pagina - 1) * POR_PAGINA;
  const { data, count } = await consulta.range(desde, desde + POR_PAGINA - 1);
  const preguntas = (data ?? []) as FilaPregunta[];
  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));

  const enlacePagina = (p: number) => {
    const params = new URLSearchParams(filtrosActuales);
    params.set("pagina", String(p));
    return `?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            Banco bíblico
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Preguntas de Trivia en línea y Elim Arena. Cada lunes se revisa solo: si a la mayoría de los
            jugadores le quedan menos de 100 sin ver, se generan 100 nuevas que esperan tu aprobación aquí.
          </p>
        </div>
        <BotonRevisarBanco filtros={filtrosActuales} />
      </div>

      {sp.ok && (
        <p className="text-sm px-4 py-3 rounded-xl" style={{ background: "rgba(74,222,128,0.1)", color: "var(--color-success)" }}>
          {sp.ok}
        </p>
      )}
      {sp.error && (
        <p className="text-sm px-4 py-3 rounded-xl" style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-destructive)" }}>
          {sp.error}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {NIVELES.map((n, i) => (
          <div key={n} className="p-3 rounded-xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{NIVEL_LABEL[n]}</p>
            <p className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>{activasPorNivel[i]}</p>
          </div>
        ))}
        <Link href="?vista=pendientes" className="p-3 rounded-xl" style={{ background: "var(--color-surface)", border: `1px solid ${pendientes > 0 ? "var(--color-primary)" : "var(--color-border)"}` }}>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Pendientes</p>
          <p className="text-2xl font-bold" style={{ color: pendientes > 0 ? "var(--color-primary)" : "var(--color-text)" }}>{pendientes}</p>
        </Link>
        <Link href="?vista=desactivadas" className="p-3 rounded-xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Desactivadas</p>
          <p className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>{desactivadas}</p>
        </Link>
      </div>

      <details className="rounded-2xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <summary className="px-5 py-3 text-sm font-semibold cursor-pointer" style={{ color: "var(--color-primary)" }}>
          + Agregar pregunta
        </summary>
        <div className="px-2 pb-2">
          <PreguntaFormBanco filtros={filtrosActuales} />
        </div>
      </details>

      <form method="get" className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <select name="vista" defaultValue={vista} className="rounded-xl px-3 py-2 text-sm" style={inputStyle} aria-label="Estado">
          {Object.entries(VISTAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="nivel" defaultValue={nivel} className="rounded-xl px-3 py-2 text-sm" style={inputStyle} aria-label="Nivel">
          <option value="">Todos los niveles</option>
          {NIVELES.map((n) => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}
        </select>
        <select name="categoria" defaultValue={categoria} className="rounded-xl px-3 py-2 text-sm" style={inputStyle} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
        </select>
        <select name="orden" defaultValue={orden} className="rounded-xl px-3 py-2 text-sm" style={inputStyle} aria-label="Orden">
          {Object.entries(ORDENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex gap-2 col-span-2 sm:col-span-1">
          <input name="q" defaultValue={buscar} placeholder="Buscar…" className="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm" style={inputStyle} />
          <button type="submit" className="px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--color-primary)", color: "#000" }}>
            Ver
          </button>
        </div>
      </form>

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {count ?? 0} {count === 1 ? "pregunta" : "preguntas"} · página {pagina} de {totalPaginas}
      </p>

      <div className="flex flex-col gap-3">
        {preguntas.length === 0 ? (
          <p className="text-sm py-10 text-center" style={{ color: "var(--color-text-muted)" }}>
            No hay preguntas con estos filtros.
          </p>
        ) : (
          preguntas.map((p) => <PreguntaFila key={p.id} pregunta={p} filtros={filtrosActuales} />)
        )}
      </div>

      {totalPaginas > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Páginas">
          {pagina > 1 && <Link href={enlacePagina(pagina - 1)} style={{ color: "var(--color-primary)" }}>← Anterior</Link>}
          <span style={{ color: "var(--color-text-muted)" }}>{pagina} / {totalPaginas}</span>
          {pagina < totalPaginas && <Link href={enlacePagina(pagina + 1)} style={{ color: "var(--color-primary)" }}>Siguiente →</Link>}
        </nav>
      )}
    </div>
  );
}
