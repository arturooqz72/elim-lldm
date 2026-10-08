// src/app/admin/palabra/page.tsx
import { AlertTriangle, ArrowDown, ArrowUp, CalendarCheck, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { PALABRA_AVISO_DIAS } from "@/lib/palabra/config";
import { diasEntre, NOMBRE_CATEGORIA, numeroDelDia, sumarDias } from "@/lib/palabra/logica";
import { fechaDeHoy } from "@/lib/palabra/servidor";
import type { PalabraDiaria } from "@/types";
import { PalabraDiariaForm } from "@/components/admin/PalabraDiariaForm";
import { PalabraStatsAdmin } from "@/components/admin/PalabraStatsAdmin";
import { eliminarPalabra, guardarPalabra, moverPalabra } from "./acciones";

export const metadata = { title: "Palabra del Día — Admin" };
export const dynamic = "force-dynamic";

const RUTA = "/admin/palabra";

interface Props {
  searchParams: Promise<{ edit?: string; error?: string; ok?: string; todas?: string }>;
}

function etiquetaFecha(fecha: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${fecha}T12:00:00Z`)
  );
}

export default async function PalabraAdminPage({ searchParams }: Props) {
  const { edit: editId, error, ok, todas } = await searchParams;
  const hoy = fechaDeHoy();
  const supabase = await createServiceClient();

  let consulta = supabase.from("palabra_diaria").select("*").order("fecha", { ascending: true });
  if (todas !== "1") consulta = consulta.gte("fecha", sumarDias(hoy, -7));
  const { data } = await consulta;
  const palabras = (data ?? []) as PalabraDiaria[];
  const editando = editId ? palabras.find((p) => p.id === editId) : undefined;

  // Días seguidos cubiertos desde hoy (un hueco corta la cuenta).
  const fechas = new Set(palabras.map((p) => p.fecha));
  let cubiertos = 0;
  while (fechas.has(sumarDias(hoy, cubiertos))) cubiertos += 1;
  const ultima = palabras.at(-1)?.fecha ?? null;
  const siguienteLibre = (() => {
    let f = hoy;
    while (fechas.has(f)) f = sumarDias(f, 1);
    return f;
  })();
  const pocas = cubiertos < PALABRA_AVISO_DIAS;
  const futurasIds = palabras.filter((p) => p.fecha > hoy).map((p) => p.id);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <CalendarCheck size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Palabra del Día
        </h1>
      </div>

      <div
        className="flex items-start gap-3 p-4 rounded-xl mb-4 text-sm"
        style={{
          background: pocas ? "rgba(248,113,113,0.08)" : "rgba(74,222,128,0.06)",
          border: `1px solid ${pocas ? "rgba(248,113,113,0.35)" : "rgba(74,222,128,0.25)"}`,
          color: "var(--color-text)",
        }}
      >
        {pocas ? (
          <AlertTriangle size={18} className="shrink-0" style={{ color: "var(--color-destructive)" }} />
        ) : (
          <CheckCircle2 size={18} className="shrink-0" style={{ color: "var(--color-success)" }} />
        )}
        <p>
          {cubiertos === 0
            ? "¡No hay palabra programada para hoy! Los jugadores verán el juego vacío."
            : `Hay palabras para ${cubiertos} ${cubiertos === 1 ? "día seguido" : "días seguidos"} desde hoy (hasta el ${sumarDias(hoy, cubiertos - 1)}).`}
          {pocas && ` Quedan menos de ${PALABRA_AVISO_DIAS} días: agrega más palabras.`}
          {ultima && ultima !== sumarDias(hoy, cubiertos - 1) && cubiertos > 0 && ` Ojo: hay un hueco el ${siguienteLibre}.`}
        </p>
      </div>

      {(error || ok) && (
        <p
          className="px-4 py-3 rounded-xl mb-4 text-sm"
          style={{
            background: error ? "rgba(248,113,113,0.08)" : "rgba(212,160,23,0.08)",
            color: error ? "var(--color-destructive)" : "var(--color-primary)",
          }}
        >
          {error ?? ok}
        </p>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Programadas ({palabras.length})
            </h2>
            <a href={todas === "1" ? RUTA : `${RUTA}?todas=1`} className="text-xs underline" style={{ color: "var(--color-primary)" }}>
              {todas === "1" ? "Ver solo recientes" : "Ver todo el historial"}
            </a>
          </div>

          {palabras.map((p) => {
            const esHoy = p.fecha === hoy;
            const pasada = p.fecha < hoy;
            const idx = futurasIds.indexOf(p.id);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: "var(--color-surface)",
                  border: `1px solid ${esHoy || editId === p.id ? "rgba(212,160,23,0.45)" : "var(--color-border)"}`,
                  opacity: pasada ? 0.55 : 1,
                }}
              >
                <div className="w-24 shrink-0">
                  <p className="text-xs font-semibold" style={{ color: esHoy ? "var(--color-primary)" : "var(--color-text)" }}>
                    {esHoy ? "HOY" : etiquetaFecha(p.fecha)}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                    #{numeroDelDia(p.fecha)} · {diasEntre(hoy, p.fecha) > 0 ? `en ${diasEntre(hoy, p.fecha)} d` : pasada ? "pasada" : "en juego"}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold tracking-widest" style={{ color: "var(--color-text)" }}>
                    {p.palabra}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                    {NOMBRE_CATEGORIA[p.categoria] ?? "Sin categoría"} · {p.libro} {p.capitulo} · {p.referencia} ·{" "}
                    {p.explicacion}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {idx >= 0 && (
                    <>
                      <form action={moverPalabra}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="direccion" value="arriba" />
                        <button type="submit" disabled={idx === 0} aria-label="Subir un día" className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}>
                          <ArrowUp size={13} />
                        </button>
                      </form>
                      <form action={moverPalabra}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="direccion" value="abajo" />
                        <button type="submit" disabled={idx === futurasIds.length - 1} aria-label="Bajar un día" className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}>
                          <ArrowDown size={13} />
                        </button>
                      </form>
                    </>
                  )}
                  {!pasada && (
                    <a href={`${RUTA}?edit=${p.id}`} aria-label="Editar" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(212,160,23,0.1)", color: "var(--color-primary)" }}>
                      <Pencil size={13} />
                    </a>
                  )}
                  {idx >= 0 && (
                    <form action={eliminarPalabra}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" aria-label="Eliminar" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-destructive)" }}>
                        <Trash2 size={13} />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-8 self-start">
          <PalabraDiariaForm
            action={guardarPalabra}
            editando={editando ?? null}
            fechaSugerida={siguienteLibre}
            fechaMinima={hoy}
            bloquearPalabra={Boolean(editando && editando.fecha <= hoy)}
            cancelarHref={RUTA}
          />
        </div>
      </div>

      <PalabraStatsAdmin hoy={hoy} />
    </div>
  );
}
