import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { leerEstadisticas } from "@/lib/ingles/estadisticas.server";
import { inglesConfig, pagosActivos } from "@/lib/ingles/config";

export const metadata = { title: "Estadísticas de Elim English — Admin" };

const RANGOS = [7, 14, 30] as const;

const borde = { background: "var(--color-surface)", border: "1px solid var(--color-border)" };

function fechaCorta(dia: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${dia}T12:00:00Z`),
  );
}

function Tarjeta({ valor, titulo, nota }: { valor: string | number; titulo: string; nota?: string }) {
  return (
    <div className="rounded-2xl p-4" style={borde}>
      <p className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
        {typeof valor === "number" ? valor.toLocaleString("es-MX") : valor}
      </p>
      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
        {titulo}
      </p>
      {nota && (
        <p className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)" }}>
          {nota}
        </p>
      )}
    </div>
  );
}

// El layout de /admin ya exige rol admin; los datos se leen con service role.
export default async function EstadisticasInglesPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: diasParam } = await searchParams;
  const numDias = RANGOS.find((r) => String(r) === diasParam) ?? 14;
  const supabase = await createServiceClient();
  const { dias, totales, modos, alLimite, prueba, app } = await leerEstadisticas(supabase, numDias);
  const maxMensajes = Math.max(1, ...dias.map((d) => d.mensajes));

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <GraduationCap size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Estadísticas de Elim English
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        Uso de /ingles por día, en hora del Pacífico. No incluye cuentas admin. Compras{" "}
        <strong style={{ color: "var(--color-text)" }}>{pagosActivos() ? "activas" : "pausadas"}</strong>.
      </p>

      <div className="flex gap-2 mb-6">
        {RANGOS.map((r) => (
          <Link
            key={r}
            href={`/admin/ingles?dias=${r}`}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={
              r === numDias
                ? { background: "var(--color-primary)", color: "#000" }
                : { ...borde, color: "var(--color-text-muted)" }
            }
          >
            Últimos {r} días
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Tarjeta valor={totales.personasVisitaron} titulo="Personas que entraron a /ingles" nota="con o sin cuenta" />
        <Tarjeta valor={totales.usuariosActivos} titulo="Usaron la tutora" nota="mandaron al menos un mensaje" />
        <Tarjeta
          valor={totales.regresaron}
          titulo="Regresaron"
          nota="la usaron en el rango y ya la habían usado otro día antes"
        />
        <Tarjeta valor={totales.mensajes} titulo="Mensajes de chat" />
        <Tarjeta valor={totales.intentosPronunciacion} titulo="Intentos de pronunciación" />
        <Tarjeta
          valor={totales.llegaronAlLimite}
          titulo="Veces que alguien llegó al límite"
          nota="una por persona por día"
        />
        <Tarjeta valor={totales.listaEsperaTotal} titulo="En la lista de espera" nota="total, desde siempre" />
        <Tarjeta
          valor={`$${totales.costoAproxUsd.toFixed(2)} USD`}
          titulo="Costo aprox. de Anthropic"
          nota="estimado, incluye la prueba sin cuenta; el real está en tu consola de Anthropic"
        />
        <Tarjeta
          valor={`$${totales.costoAzureUsd.toFixed(2)} USD`}
          titulo="Costo aprox. de Azure (pronunciación)"
          nota={`${totales.minutosAzure.toLocaleString("es-MX")} min de audio; con el plan gratis (F0) las primeras 5 h al mes no se cobran`}
        />
        <Tarjeta
          valor={prueba.visitantes}
          titulo="Prueba sin cuenta: visitantes que la usaron"
          nota={`${prueba.crearonCuenta} crearon cuenta${
            prueba.visitantes ? ` (${Math.round((prueba.crearonCuenta / prueba.visitantes) * 100)}%)` : ""
          }${prueba.yaTeniaCuenta ? ` · ${prueba.yaTeniaCuenta} ya tenían cuenta` : ""} · ${prueba.mensajes} mensajes`}
        />
        <Tarjeta
          valor={totales.aperturasApp}
          titulo="Veces que se abrió desde la app instalada"
          nota={`${app.personas} ${app.personas === 1 ? "persona" : "personas"} · iPhone ${app.ios} · Android ${app.android}${
            app.otro ? ` · otros ${app.otro}` : ""
          }`}
        />
        <Tarjeta
          valor={totales.usuariosActivos ? (totales.mensajes / totales.usuariosActivos).toFixed(1) : "—"}
          titulo="Mensajes por persona activa"
        />
      </div>

      <div className="rounded-2xl overflow-x-auto mb-8" style={borde}>
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              {[
                "Día",
                "Entraron",
                "Usaron",
                "Regresaron",
                "Mensajes",
                "Al límite",
                "Pronunciación",
                "Lista de espera",
                "App",
              ].map((t) => (
                <th
                  key={t}
                  className="text-left font-semibold px-4 py-3"
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...dias].reverse().map((d) => (
              <tr key={d.dia} style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
                  {fechaCorta(d.dia)}
                </td>
                <td className="px-4 py-2.5">{d.personasVisitaron}</td>
                <td className="px-4 py-2.5">{d.usuariosActivos}</td>
                <td className="px-4 py-2.5">{d.regresaron}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-right">{d.mensajes}</span>
                    <span
                      className="h-2 rounded-full"
                      style={{ width: `${(d.mensajes / maxMensajes) * 120}px`, background: "var(--color-primary)" }}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5">{d.llegaronAlLimite}</td>
                <td className="px-4 py-2.5">{d.intentosPronunciacion}</td>
                <td className="px-4 py-2.5">{d.nuevosEnLista}</td>
                <td className="px-4 py-2.5">{d.aperturasApp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl overflow-x-auto mb-8" style={borde}>
        <div className="px-5 pt-5 pb-3">
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Personas que llegaron al límite ({alLimite.length})
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Usaron sus {inglesConfig().gratisDiarios} mensajes gratis del día al menos una vez en este rango. Si son las
            mismas personas varios días, lo usan en serio.
          </p>
        </div>
        {alLimite.length === 0 ? (
          <p className="px-5 pb-5 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Nadie llegó al límite en este rango.
          </p>
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                {[
                  "Nombre",
                  "Días al límite",
                  "Días que la usó",
                  "Mensajes",
                  "Última vez al límite",
                  "Lista de espera",
                ].map((t) => (
                  <th
                    key={t}
                    className="text-left font-semibold px-4 py-3"
                    style={{
                      borderTop: "1px solid var(--color-border)",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alLimite.map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                  <td className="px-4 py-2.5 font-medium">{p.nombre}</td>
                  <td className="px-4 py-2.5">{p.diasAlLimite}</td>
                  <td className="px-4 py-2.5">{p.diasActivos}</td>
                  <td className="px-4 py-2.5">{p.mensajes}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
                    {fechaCorta(p.ultimoDiaAlLimite)}
                  </td>
                  <td
                    className="px-4 py-2.5"
                    style={{ color: p.enListaEspera ? "var(--color-success)" : "var(--color-text-muted)" }}
                  >
                    {p.enListaEspera ? "Sí" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-2xl p-5" style={borde}>
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
          Modos más usados (mensajes de chat)
        </p>
        {modos.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Sin mensajes en este rango.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {modos.map((m) => (
              <li key={m.modo} className="flex items-center gap-3 text-sm">
                <span className="w-48 shrink-0" style={{ color: "var(--color-text-muted)" }}>
                  {m.modo}
                </span>
                <span
                  className="h-2 rounded-full"
                  style={{ width: `${(m.mensajes / modos[0].mensajes) * 200}px`, background: "var(--color-primary)" }}
                />
                <span style={{ color: "var(--color-text)" }}>{m.mensajes}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
