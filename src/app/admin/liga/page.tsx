// src/app/admin/liga/page.tsx
// Liga de Iglesias (solo admin; admin/layout.tsx ya lo revisa).
import { Trophy } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { COLUMNAS_IGLESIA, NOMBRE_AMIGOS, detalleIglesia, nombreIglesia, normalizar, type IglesiaBase } from "@/lib/liga/nombre";
import { DENOMINACIONES } from "@/lib/liga/config";
import { getDatosTarjetaLiga, getResumenComunidades, getSemanasTarjeta, semanaActual } from "@/lib/liga/consultas.server";
import { rangoCorto } from "@/lib/juegos/campeones/semana";
import { TarjetaLiga } from "@/components/admin/liga/TarjetaLiga";
import { aprobarIglesia, editarIglesia, juntarIglesias, rechazarIglesia } from "./acciones";

export const metadata = { title: "Liga de Iglesias — Admin" };
export const dynamic = "force-dynamic";

type Fila = IglesiaBase & { aprobada: boolean; creada_por: string | null };

const boton = "px-3 py-2 rounded-lg text-xs font-semibold min-h-9";
const campo = { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" } as const;
const caja = { background: "var(--color-surface)", border: "1px solid var(--color-border)" } as const;

function Numero({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl p-3 flex flex-col" style={caja}>
      <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--color-text)" }}>{valor}</span>
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{etiqueta}</span>
    </div>
  );
}

export default async function AdminLigaPage({ searchParams }: { searchParams: Promise<{ error?: string; semana?: string }> }) {
  const { error, semana: pedida } = await searchParams;
  const service = await createServiceClient();
  const semana = semanaActual();

  const [{ data: igl }, { data: perf }, { data: pts }, semanas, resumen] = await Promise.all([
    service.from("iglesias").select(`${COLUMNAS_IGLESIA}, aprobada, creada_por`).order("ciudad"),
    service.from("profiles").select("id, iglesia_id, display_name").not("iglesia_id", "is", null),
    service.from("liga_puntos").select("iglesia_id, puntos").eq("semana", semana),
    getSemanasTarjeta(),
    getResumenComunidades(),
  ]);
  const todas = (igl ?? []) as Fila[];
  const aprobadas = todas.filter((i) => i.aprobada);
  const pendientes = todas.filter((i) => !i.aprobada);
  const jugadores = new Map<string, number>();
  const nombres = new Map<string, string>();
  for (const p of (perf ?? []) as Array<{ id: string; iglesia_id: string; display_name: string }>) {
    jugadores.set(p.iglesia_id, (jugadores.get(p.iglesia_id) ?? 0) + 1);
    nombres.set(p.id, p.display_name);
  }
  const puntos = new Map<string, number>();
  for (const r of (pts ?? []) as Array<{ iglesia_id: string | null; puntos: number }>) {
    if (r.iglesia_id) puntos.set(r.iglesia_id, (puntos.get(r.iglesia_id) ?? 0) + r.puntos);
  }
  const semanaTarjeta = pedida && semanas.includes(pedida) ? pedida : semanas[0];
  const datosTarjeta = await getDatosTarjetaLiga(semanaTarjeta);
  const editables = aprobadas.filter((i) => i.comunidad !== "amigos");
  const amigos = aprobadas.find((i) => i.comunidad === "amigos");
  const juntables = editables;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <Trophy size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>Liga de Iglesias</h1>
      </div>
      {error && <p className="text-sm p-3 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-destructive)" }}>{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Resumen de jugadores</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Numero etiqueta="Iglesia La Luz del Mundo" valor={resumen.lldm} />
          <Numero etiqueta="Otras denominaciones" valor={resumen.otras.reduce((s, o) => s + o.jugadores, 0)} />
          <Numero etiqueta={NOMBRE_AMIGOS} valor={resumen.amigos} />
          <Numero etiqueta="Todavía no eligen" valor={resumen.sinElegir} />
        </div>
        {resumen.otras.length > 0 && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{resumen.otras.map((o) => `${o.denominacion}: ${o.jugadores}`).join(" · ")}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Pendientes de aprobar ({pendientes.length})</h2>
        {pendientes.length === 0 && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No hay equipos pendientes.</p>}
        {pendientes.map((i) => {
          const parecidas = editables.filter((a) => a.comunidad === i.comunidad && a.denominacion === i.denominacion && normalizar(a.ciudad) === normalizar(i.ciudad));
          return (
            <div key={i.id} className="rounded-xl p-4 flex flex-col gap-3" style={caja}>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{i.comunidad === "lldm" ? "LLDM" : i.denominacion} · {detalleIglesia(i)}</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Propuesta por {i.creada_por ? (nombres.get(i.creada_por) ?? "un jugador") : "—"} · {jugadores.get(i.id) ?? 0} jugadores · {puntos.get(i.id) ?? 0} pts esta semana
                </p>
                {parecidas.length > 0 && <p className="text-xs mt-1" style={{ color: "var(--color-primary)" }}>Parecidas: {parecidas.map((a) => detalleIglesia(a)).join(" · ")}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={aprobarIglesia}><input type="hidden" name="id" value={i.id} /><button className={boton} style={{ background: "var(--color-primary)", color: "#000" }}>Aprobar</button></form>
                <form action={rechazarIglesia}><input type="hidden" name="id" value={i.id} /><button className={boton} style={{ ...campo, color: "var(--color-destructive)" }}>Rechazar</button></form>
                {juntables.length > 0 && (
                  <form action={juntarIglesias} className="flex gap-2">
                    <input type="hidden" name="id" value={i.id} />
                    <select name="conservar" defaultValue={parecidas[0]?.id ?? ""} className="px-2 rounded-lg text-xs" style={campo}>
                      <option value="">Juntar con…</option>
                      {juntables.map((a) => <option key={a.id} value={a.id}>{nombreIglesia(a, aprobadas)} ({a.estado}, {a.pais})</option>)}
                    </select>
                    <button className={boton} style={campo}>Juntar</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Aprobados ({aprobadas.length})</h2>
        {amigos && <p className="text-sm rounded-xl p-3" style={{ ...caja, color: "var(--color-text)" }}>{NOMBRE_AMIGOS} · <span style={{ color: "var(--color-text-muted)" }}>{jugadores.get(amigos.id) ?? 0} jugadores · {puntos.get(amigos.id) ?? 0} pts (no se edita)</span></p>}
        {editables.map((i) => (
          <details key={i.id} className="rounded-xl p-4" style={caja}>
            <summary className="text-sm cursor-pointer" style={{ color: "var(--color-text)" }}>
              {nombreIglesia(i, aprobadas)} · <span style={{ color: "var(--color-text-muted)" }}>{i.estado}, {i.pais} · {jugadores.get(i.id) ?? 0} jugadores · {puntos.get(i.id) ?? 0} pts</span>
            </summary>
            <form action={editarIglesia} className="flex flex-wrap gap-2 mt-3">
              <input type="hidden" name="id" value={i.id} />
              <input type="hidden" name="comunidad" value={i.comunidad} />
              {i.comunidad === "otra" && (
                <select name="denominacion" defaultValue={i.denominacion ?? ""} className="px-2 py-1.5 rounded-lg text-sm" style={campo}>
                  {DENOMINACIONES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <input name="ciudad" defaultValue={i.ciudad ?? ""} maxLength={60} className="px-2 py-1.5 rounded-lg text-sm" style={campo} />
              <input name="estado" defaultValue={i.estado ?? ""} maxLength={60} className="px-2 py-1.5 rounded-lg text-sm" style={campo} />
              <input name="pais" defaultValue={i.pais ?? ""} maxLength={60} className="px-2 py-1.5 rounded-lg text-sm" style={campo} />
              <button className={boton} style={{ background: "var(--color-primary)", color: "#000" }}>Guardar</button>
            </form>
          </details>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Generar tarjeta de la Liga</h2>
        <form method="get" className="flex items-end gap-2">
          <select name="semana" defaultValue={semanaTarjeta} className="px-3 py-2 rounded-lg text-sm" style={campo}>
            {semanas.map((s) => <option key={s} value={s}>{rangoCorto(s)}{s === semana ? " (en curso)" : ""}</option>)}
          </select>
          <button className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--color-primary)", color: "#000" }}>Ver</button>
        </form>
        <TarjetaLiga datos={datosTarjeta} />
      </section>
    </div>
  );
}
