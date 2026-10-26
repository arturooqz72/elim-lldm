// src/lib/elim-ia/acceso.ts
// Quién puede usar Elim IA: solo moderadores hacia arriba (2026-10-25). A
// los demás no se les muestra en el menú, la página los manda al inicio y
// la API les responde 403. Lo usan el servidor y el layout público.

const ROLES_ELIM_IA = ["moderador", "super_moderador", "admin"];

export function puedeUsarElimIa(role: string | null | undefined): boolean {
  return !!role && ROLES_ELIM_IA.includes(role);
}
