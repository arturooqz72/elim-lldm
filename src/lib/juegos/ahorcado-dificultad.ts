// src/lib/juegos/ahorcado-dificultad.ts
//
// Lo que comparten el servidor del Ahorcado (ahorcado.server.ts) y la
// pantalla del juego: los niveles de dificultad y la forma del estado que
// recibe el navegador. Aquí no hay nada secreto.

export type Dificultad = "facil" | "normal" | "dificil";

export const DIFICULTADES_ORDEN: Dificultad[] = ["facil", "normal", "dificil"];

export interface ConfigDificultad {
  nombre: string;
  descripcion: string;
  vidas: number;
  /** Puntos por cada vida que quede al adivinar la palabra. */
  puntosPorVida: number;
  /** "gratis": no cuestan nada; "con-costo": una vida y PUNTOS_POR_PISTA cada una. */
  pistas: "gratis" | "con-costo" | "ninguna";
  /** Letras mínimas de la palabra (sin contar espacios). */
  largoMinimo: number;
}

export const DIFICULTADES: Record<Dificultad, ConfigDificultad> = {
  facil: {
    nombre: "Fácil",
    descripcion: "Pistas gratis. 5 puntos por vida.",
    vidas: 6,
    puntosPorVida: 5,
    pistas: "gratis",
    largoMinimo: 0,
  },
  normal: {
    nombre: "Normal",
    descripcion: "Cada pista cuesta una vida y 5 puntos. 10 puntos por vida.",
    vidas: 6,
    puntosPorVida: 10,
    pistas: "con-costo",
    largoMinimo: 0,
  },
  dificil: {
    nombre: "Difícil",
    descripcion: "Sin pistas, 4 vidas y palabras largas. 20 puntos por vida.",
    vidas: 4,
    puntosPorVida: 20,
    pistas: "ninguna",
    largoMinimo: 7,
  },
};

export const TOTAL_PISTAS = 3;
/** Puntos que resta cada pista en Normal (además de la vida). */
export const PUNTOS_POR_PISTA = 5;

export function esDificultad(valor: unknown): valor is Dificultad {
  return valor === "facil" || valor === "normal" || valor === "dificil";
}

export interface PistaAhorcado {
  titulo: string;
  texto: string;
}

/** Lo que sí puede ver el navegador mientras se juega y al terminar. */
export interface EstadoAhorcado {
  /** Una entrada por carácter: la letra si ya la adivinó, "_" si no, " " para espacios. */
  mascara: string[];
  letras: string[];
  /** Letras usadas que sí están en la palabra (para pintar el teclado). */
  correctas: string[];
  vidas: number;
  vidasIniciales: number;
  estado: "jugando" | "ganada" | "perdida";
  dificultad: Dificultad;
  puntos: number;
  ganadas: number;
  /** Puntos que dio esta palabra (solo cuando estado = "ganada"). */
  puntosPalabra: number;
  /** Solo las pistas ya pedidas, en orden. */
  pistas: PistaAhorcado[];
  /** 0 en Difícil. */
  pistasTotales: number;
  /** Solo cuando la partida ya terminó. */
  palabra: string | null;
  /** Categoría, descripción y cita completas: solo cuando la partida ya terminó. */
  revelacion: { categoria: string; descripcion: string; referencia: string | null } | null;
  /** Si al ganar esta palabra se guardó un nuevo récord en el ranking. */
  nuevoRecord?: boolean;
}

/** No hay palabra en curso: hay que elegir dificultad antes de empezar. */
export interface SinPartidaAhorcado {
  necesitaDificultad: true;
  /** La última que usó, para dejarla marcada. */
  dificultad: Dificultad;
}
