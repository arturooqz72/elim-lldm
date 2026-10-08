import Link from "next/link";
import { Smartphone } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { leerEstadisticasRadioApp } from "@/lib/radio/estadisticas.server";

export const metadata = { title: "App de la Radio — Admin" };

const RANGOS = [7, 14, 30] as const;

const borde = { background: "var(--color-surface)", border: "1px solid var(--color-border)" };

function fechaCorta(dia: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${dia}T12:00:00Z`),
  );
}

function Tarjeta({ valor, titulo, nota }: { valor: number; titulo: string; nota?: string }) {
  return (
    <div className="rounded-2xl p-4" style={borde}>
      <p className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
        {valor.toLocaleString("es-MX")}
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
export default async function RadioAppAdminPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: diasParam } = await searchParams;
  const numDias = RANGOS.find((r) => String(r) === diasParam) ?? 14;
  const supabase = await createServiceClient();
  const { dias, totales } = await leerEstadisticasRadioApp(supabase, numDias);
  const maxAperturas = Math.max(1, ...dias.map((d) => d.aperturas));

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Smartphone size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          App de la Radio
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        Veces que se abrió Radio Elim desde el ícono de la app instalada (no desde el navegador), por día en hora
        del Pacífico. Una misma persona cuenta una vez cada 5 minutos. No incluye cuentas admin. Enlace:{" "}
        <a href="/escuchar" className="underline" style={{ color: "var(--color-primary)" }}>
          elimlldm.net/escuchar
        </a>
      </p>

      <div className="flex gap-2 mb-6">
        {RANGOS.map((r) => (
          <Link
            key={r}
            href={`/admin/radio?dias=${r}`}
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
        <Tarjeta valor={totales.aperturas} titulo="Aperturas desde la app" nota={totales.otro ? `otros ${totales.otro}` : undefined} />
        <Tarjeta valor={totales.personas} titulo="Personas distintas" nota="con o sin cuenta" />
        <Tarjeta valor={totales.android} titulo="Android" />
        <Tarjeta valor={totales.ios} titulo="iPhone" />
      </div>

      <div className="rounded-2xl overflow-x-auto mb-8" style={borde}>
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              {["Día", "Aperturas", "Android", "iPhone", "Otros", "Personas"].map((t) => (
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
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-right">{d.aperturas}</span>
                    <span
                      className="h-2 rounded-full"
                      style={{ width: `${(d.aperturas / maxAperturas) * 120}px`, background: "var(--color-primary)" }}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5">{d.android}</td>
                <td className="px-4 py-2.5">{d.ios}</td>
                <td className="px-4 py-2.5">{d.otro}</td>
                <td className="px-4 py-2.5">{d.personas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
