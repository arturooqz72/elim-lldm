// src/lib/trivia/banco.ts
// Constantes y etiquetas del banco de preguntas, compartidas entre el
// servidor y el panel de admin (sin nada secreto).

export const BANCO_SET_ID = "b1b11000-0000-4000-8000-000000000001";

export const NIVELES = ["facil", "normal", "dificil"] as const;
export type Nivel = (typeof NIVELES)[number];

export const CATEGORIAS = [
  "personajes",
  "lugares",
  "milagros",
  "profetas",
  "evangelios",
  "antiguo_testamento",
  "nuevo_testamento",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ESTADOS = ["aprobada", "pendiente", "rechazada"] as const;
export type EstadoPregunta = (typeof ESTADOS)[number];

export const NIVEL_LABEL: Record<Nivel, string> = {
  facil: "Fácil",
  normal: "Normal",
  dificil: "Difícil",
};

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  personajes: "Personajes",
  lugares: "Lugares",
  milagros: "Milagros",
  profetas: "Profetas",
  evangelios: "Evangelios",
  antiguo_testamento: "Antiguo Testamento",
  nuevo_testamento: "Nuevo Testamento",
};

export const ESTADO_LABEL: Record<EstadoPregunta, string> = {
  aprobada: "Aprobada",
  pendiente: "Pendiente de revisión",
  rechazada: "Rechazada",
};

export function esNivel(v: unknown): v is Nivel {
  return typeof v === "string" && (NIVELES as readonly string[]).includes(v);
}

export function esCategoria(v: unknown): v is Categoria {
  return typeof v === "string" && (CATEGORIAS as readonly string[]).includes(v);
}
