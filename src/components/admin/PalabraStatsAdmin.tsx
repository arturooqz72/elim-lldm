// src/components/admin/PalabraStatsAdmin.tsx
import { BarChart3 } from "lucide-react";
import { PALABRA_INICIO_PISTAS, PALABRA_INICIO_RECHAZOS } from "@/lib/palabra/config";
import { leerEstadisticasPalabra } from "@/lib/palabra/estadisticas-admin.server";

const borde = { background: "var(--color-surface)", border: "1px solid var(--color-border)" } as const;

function fechaCorta(fecha: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${fecha}T12:00:00Z`)
  );
}

/** Estadísticas de los últimos 14 días, debajo de la lista de /admin/palabra. */
export async function PalabraStatsAdmin({ hoy }: { hoy: string }) {
  const { dias, masRechazadas } = await leerEstadisticasPalabra(hoy);
  const total = dias.reduce(
    (t, d) => ({
      ganadas: t.ganadas + d.ganadas,
      terminadas: t.terminadas + d.ganadas + d.perdidas,
      antes: t.antes + (d.conPistasNuevas ? d.antesSegundaPista : 0),
      despues: t.despues + (d.conPistasNuevas ? d.despuesSegundaPista : 0),
      rechazadas: t.rechazadas + d.rechazadas,
    }),
    { ganadas: 0, terminadas: 0, antes: 0, despues: 0, rechazadas: 0 }
  );

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={18} style={{ color: "var(--color-primary)" }} />
        <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
          Estadísticas — últimos 14 días
        </h2>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
        Sin cuentas admin. % de victorias = ganadas ÷ terminadas
        {total.terminadas > 0 && ` (en total: ${Math.round((total.ganadas / total.terminadas) * 100)}%)`}. &quot;Antes de
        la 2.ª pista&quot; = ganaron en 1 o 2 intentos; &quot;después&quot; = ganaron ya con &quot;Búscala en…&quot;
        a la vista. Las pistas nuevas empezaron el {fechaCorta(PALABRA_INICIO_PISTAS)}; los días anteriores muestran
        —. Desde entonces: {total.antes} antes y {total.despues} después. &quot;Rechazadas&quot; = intentos que no
        estaban en la lista de palabras válidas (se registran desde el {fechaCorta(PALABRA_INICIO_RECHAZOS)}; en
        total: {total.rechazadas}).
      </p>

      <div className="rounded-2xl overflow-x-auto" style={borde}>
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              {["Día", "Palabra", "Empezadas", "Ganadas", "Perdidas", "Abandonadas", "% victorias", "Antes 2.ª pista", "Después 2.ª pista", "Rechazadas"].map(
                (t) => (
                  <th key={t} className="text-left font-semibold px-3 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {t}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.fecha} style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: d.fecha === hoy ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                  {d.fecha === hoy ? "Hoy" : fechaCorta(d.fecha)}
                </td>
                <td className="px-3 py-2.5 font-semibold tracking-wider">{d.palabra ?? "—"}</td>
                <td className="px-3 py-2.5">{d.empezadas}</td>
                <td className="px-3 py-2.5">{d.ganadas}</td>
                <td className="px-3 py-2.5">{d.perdidas}</td>
                <td className="px-3 py-2.5">
                  {d.abandonadas}
                  {d.enCurso > 0 && (
                    <span className="text-[11px] ml-1" style={{ color: "var(--color-text-muted)" }}>
                      ({d.enCurso} en curso)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">{d.porcentaje === null ? "—" : `${d.porcentaje}%`}</td>
                <td className="px-3 py-2.5">{d.conPistasNuevas ? d.antesSegundaPista : "—"}</td>
                <td className="px-3 py-2.5">{d.conPistasNuevas ? d.despuesSegundaPista : "—"}</td>
                <td className="px-3 py-2.5">{d.conRechazos ? d.rechazadas : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl p-4 mt-4" style={borde}>
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Palabras rechazadas más intentadas
        </p>
        <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--color-text-muted)" }}>
          No están en la lista de válidas. Si alguna es una palabra real que intenta mucha gente, conviene agregarla.
        </p>
        {masRechazadas.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Todavía no hay rechazos registrados.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {masRechazadas.map((r) => (
              <span
                key={r.intento}
                className="px-2.5 py-1 rounded-lg text-xs"
                style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
              >
                <strong className="tracking-wider">{r.intento}</strong>{" "}
                <span style={{ color: "var(--color-text-muted)" }}>
                  {r.veces}× · {r.personas} {r.personas === 1 ? "persona" : "personas"}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
