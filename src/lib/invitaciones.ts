// Invitaciones a jugar enviadas desde /admin/en-linea a alguien que tiene el
// sitio abierto. Viajan por un canal Realtime por usuario; el aviso solo
// muestra juegos de esta lista fija (nunca un texto o enlace que venga en el
// mensaje), así nadie puede usar el canal para mandar enlaces raros.

export const JUEGOS_INVITACION = [
  { clave: "trivia", nombre: "Trivia en línea", href: "/arena-abierta" },
  { clave: "ruleta", nombre: "La Ruleta en línea", href: "/ruleta" },
  { clave: "palabra", nombre: "Palabra del Día", href: "/juegos/palabra" },
  { clave: "ahorcado", nombre: "Ahorcado", href: "/juegos/ahorcado" },
] as const;

export type ClaveJuegoInvitacion = (typeof JUEGOS_INVITACION)[number]["clave"];

export const EVENTO_INVITACION = "INVITACION";

export function canalInvitacion(userId: string): string {
  return `invitacion:${userId}`;
}

export function juegoInvitacion(clave: unknown) {
  return JUEGOS_INVITACION.find((j) => j.clave === clave) ?? null;
}
