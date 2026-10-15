import type { EstadisticasEnganche } from "@/lib/ingles/estadisticas-enganche.server";
import { ETIQUETA_BOTON, type BotonRapido } from "@/lib/ingles/saludos";
import { BotonPushPrueba } from "./BotonPushPrueba";

const borde = { background: "var(--color-surface)", border: "1px solid var(--color-border)" };
const celda = "px-4 py-2.5";
const encabezado = "text-left font-semibold px-4 py-3";
const BOTONES: BotonRapido[] = ["pronunciacion", "platicar", "reto", "principiante"];

function fechaCorta(dia: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${dia}T12:00:00Z`),
  );
}

function porcentaje(parte: number, total: number): string {
  return total > 0 ? `${Math.round((parte / total) * 100)}%` : "—";
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

function Cifra({ valor, titulo }: { valor: number | string; titulo: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--color-surface-elevated)" }}>
      <p className="text-xl font-bold tabular-nums" style={{ color: "var(--color-text)" }}>
        {valor}
      </p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
        {titulo}
      </p>
    </div>
  );
}

function Tabla({ columnas, children }: { columnas: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[420px]">
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

/** Saludo con botones de respuesta rápida y recordatorio diario en /admin/ingles. */
export function SeccionEnganche({ datos }: { datos: EstadisticasEnganche }) {
  const { botones, aviso, dias, totales } = datos;
  const fila = { borderBottom: "1px solid var(--color-border)", color: "var(--color-text)" };
  const rechazaron = aviso.ahora_no + aviso.bloqueado;

  return (
    <div className="flex flex-col gap-6 mb-8">
      <div className="rounded-2xl" style={borde}>
        <Titulo
          titulo={`Botones de respuesta rápida — ${datos.personasConBoton} personas tocaron al menos uno`}
          nota="Los botones debajo del saludo de la tutora. No gastan mensajes: el saludo y lo que contestan ya están escritos, por eso no cuentan en «Usaron la tutora»."
        />
        <Tabla columnas={["Botón", "Toques", "Personas"]}>
          {BOTONES.map((b) => (
            <tr key={b} style={fila}>
              <td className={`${celda} font-medium`}>{ETIQUETA_BOTON[b]}</td>
              <td className={`${celda} tabular-nums`}>{botones[b].toques}</td>
              <td className={`${celda} tabular-nums`}>{botones[b].personas}</td>
            </tr>
          ))}
        </Tabla>
      </div>

      <div className="rounded-2xl" style={borde}>
        <Titulo
          titulo={`Recordatorio diario — ${datos.activasAhora} ${datos.activasAhora === 1 ? "persona lo tiene" : "personas lo tienen"} activado ahora`}
          nota="Se manda a las 6 pm del Pacífico, máximo uno al día y solo a quien ese día no ha practicado. Respuestas al aviso «¿Quieres que te recuerde…?» (personas distintas en el rango)."
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 pb-4">
          <Cifra valor={aviso.si} titulo="Aceptaron" />
          <Cifra valor={rechazaron} titulo={`Rechazaron (${aviso.ahora_no} «Ahora no», ${aviso.bloqueado} bloqueado)`} />
          <Cifra valor={aviso.apagado} titulo="Lo apagaron después" />
          <Cifra
            valor={`${totales.abiertos} / ${totales.enviados}`}
            titulo={`Abrieron la app desde la notificación (${porcentaje(totales.abiertos, totales.enviados)})`}
          />
        </div>
        <Tabla columnas={["Día", "Enviados", "Abrieron la app"]}>
          {[...dias].reverse().map((d) => (
            <tr key={d.dia} style={fila}>
              <td className={`${celda} whitespace-nowrap`} style={{ color: "var(--color-text-muted)" }}>
                {fechaCorta(d.dia)}
              </td>
              <td className={`${celda} tabular-nums`}>{d.enviados}</td>
              <td className={`${celda} tabular-nums`}>{d.abiertos}</td>
            </tr>
          ))}
        </Tabla>
        <div className="px-5 py-4">
          <BotonPushPrueba />
        </div>
      </div>
    </div>
  );
}
