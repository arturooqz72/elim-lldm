import type { EstadisticasVoz } from "@/lib/ingles/estadisticas-voz.server";
import type { EncuestaRespuesta, EncuestaTipo } from "@/types";

const borde = { background: "var(--color-surface)", border: "1px solid var(--color-border)" };
const celda = "px-4 py-2.5";
const encabezado = "text-left font-semibold px-4 py-3";

const NOMBRE_ENCUESTA: Record<EncuestaTipo, string> = {
  voz: "¿Pagarías por práctica de voz ilimitada?",
  mensajes: "¿Pagarías por mensajes ilimitados?",
};
const RESPUESTA: Record<EncuestaRespuesta, string> = { no: "No pagaría", "3": "$3 al mes", "5": "$5 al mes", "10": "$10 al mes" };

function fechaCorta(dia: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${dia}T12:00:00Z`),
  );
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function Tabla({ columnas, minimo, children }: { columnas: string[]; minimo: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${minimo}`}>
        <thead>
          <tr className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            {columnas.map((t) => (
              <th
                key={t}
                className={encabezado}
                style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Titulo({ titulo, nota }: { titulo: string; nota: string }) {
  return (
    <div className="px-5 pt-5 pb-3">
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        {titulo}
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
        {nota}
      </p>
    </div>
  );
}

/** Práctica de voz en /admin/ingles: intentos, costo de Azure, límite y encuestas. */
export function SeccionVoz({ datos, vozDiarios }: { datos: EstadisticasVoz; vozDiarios: number }) {
  const { dias, totales, alLimite, encuestas, pagarian } = datos;
  const fila = { borderBottom: "1px solid var(--color-border)", color: "var(--color-text)" };

  return (
    <div className="flex flex-col gap-6 mb-8">
      <div className="rounded-2xl" style={borde}>
        <Titulo
          titulo={`Práctica de voz — ${totales.chat + totales.modo + totales.prueba} intentos · Azure ${usd(totales.costoAzureUsd)} USD`}
          nota={`Contador aparte de los mensajes: ${vozDiarios} intentos gratis al día por persona; solo cuentan los que Azure evaluó. En el rango: ${totales.chat} desde el chat, ${totales.modo} en el modo Pronunciación y ${totales.prueba} en la prueba sin cuenta. El costo de Azure es estimado.`}
        />
        <Tabla columnas={["Día", "Chat", "Pronunciación", "Prueba", "Al límite de voz", "Costo Azure"]} minimo="min-w-[640px]">
          {[...dias].reverse().map((d) => (
            <tr key={d.dia} style={fila}>
              <td className={`${celda} whitespace-nowrap`} style={{ color: "var(--color-text-muted)" }}>
                {fechaCorta(d.dia)}
              </td>
              <td className={celda}>{d.chat}</td>
              <td className={celda}>{d.modo}</td>
              <td className={celda}>{d.prueba}</td>
              <td className={celda}>{d.alLimite}</td>
              <td className={celda}>{usd(d.costoAzureUsd)}</td>
            </tr>
          ))}
        </Tabla>
      </div>

      <div className="rounded-2xl" style={borde}>
        <Titulo
          titulo={`Personas que llegaron al límite de voz (${alLimite.length})`}
          nota={`Usaron sus ${vozDiarios} intentos de voz del día al menos una vez en este rango.`}
        />
        {alLimite.length === 0 ? (
          <p className="px-5 pb-5 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Nadie llegó al límite de voz en este rango.
          </p>
        ) : (
          <Tabla columnas={["Nombre", "Días al límite", "Última vez"]} minimo="min-w-[420px]">
            {alLimite.map((p, i) => (
              <tr key={i} style={fila}>
                <td className={`${celda} font-medium`}>{p.nombre}</td>
                <td className={celda}>{p.diasAlLimite}</td>
                <td className={`${celda} whitespace-nowrap`} style={{ color: "var(--color-text-muted)" }}>
                  {fechaCorta(p.ultimoDia)}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {encuestas.map((e) => (
          <div key={e.tipo} className="rounded-2xl p-5" style={borde}>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              {NOMBRE_ENCUESTA[e.tipo]}
            </p>
            <p className="text-xs mt-1 mb-3" style={{ color: "var(--color-text-muted)" }}>
              {e.total} {e.total === 1 ? "respuesta" : "respuestas"} · desde siempre · se muestra al llegar al límite{" "}
              {e.tipo === "voz" ? "de voz" : "de mensajes"}
            </p>
            <ul className="flex flex-col gap-2">
              {(Object.keys(RESPUESTA) as EncuestaRespuesta[]).map((r) => (
                <li key={r} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0" style={{ color: "var(--color-text-muted)" }}>
                    {RESPUESTA[r]}
                  </span>
                  <span
                    className="h-2 rounded-full"
                    style={{
                      width: `${e.total ? Math.max(4, (e.respuestas[r] / e.total) * 160) : 4}px`,
                      background: r === "no" ? "var(--color-border)" : "var(--color-primary)",
                    }}
                  />
                  <span style={{ color: "var(--color-text)" }}>{e.respuestas[r]}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-2xl" style={borde}>
        <Titulo
          titulo={`Quienes dijeron que sí pagarían (${pagarian.length})`}
          nota="Respuestas de $3, $5 o $10 al mes en cualquiera de las dos encuestas, con los días distintos que han usado la tutora (mensajes o voz)."
        />
        {pagarian.length === 0 ? (
          <p className="px-5 pb-5 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Todavía nadie respondió que pagaría.
          </p>
        ) : (
          <Tabla columnas={["Nombre", "Encuesta", "Pagaría", "Días que usó la tutora"]} minimo="min-w-[520px]">
            {pagarian.map((p, i) => (
              <tr key={i} style={fila}>
                <td className={`${celda} font-medium`}>{p.nombre}</td>
                <td className={celda} style={{ color: "var(--color-text-muted)" }}>
                  {p.tipo === "voz" ? "Voz" : "Mensajes"}
                </td>
                <td className={celda}>{RESPUESTA[p.respuesta]}</td>
                <td className={celda}>{p.diasUso}</td>
              </tr>
            ))}
          </Tabla>
        )}
      </div>
    </div>
  );
}
