// src/lib/historial.ts
// Fechas del historial de visitas (/admin/historial). Se muestran en la hora
// del Pacífico, igual que el resto del sitio (ver PALABRA_TZ).

export const HISTORIAL_TZ = "America/Los_Angeles";

/** "6 oct 2026, 3:09 p.m." en la zona del historial. */
export function formatoFechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: HISTORIAL_TZ,
  }).format(new Date(iso));
}

/** Diferencia con UTC (en minutos) que tiene la zona en ese instante, ej. -420. */
function offsetMinutos(instante: Date): number {
  const nombre = new Intl.DateTimeFormat("en-US", { timeZone: HISTORIAL_TZ, timeZoneName: "longOffset" })
    .formatToParts(instante)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = nombre?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const signo = m[1] === "-" ? -1 : 1;
  return signo * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * Inicio y fin (ISO, UTC) de un día "YYYY-MM-DD" en la zona del historial.
 * Devuelve null si el texto no es una fecha válida.
 */
export function rangoDelDia(dia: string): { desde: string; hasta: string } | null {
  const m = dia.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mes, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const mediodia = new Date(Date.UTC(y, mes, d, 12));
  if (Number.isNaN(mediodia.getTime())) return null;
  const offset = offsetMinutos(mediodia);
  const desde = new Date(Date.UTC(y, mes, d) - offset * 60_000);
  const hasta = new Date(desde.getTime() + 24 * 60 * 60_000);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}
