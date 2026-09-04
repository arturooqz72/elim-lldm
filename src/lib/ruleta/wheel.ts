// Public-safe game config — shared by server (API routes) and client
// (Wheel component). Mirrors DATA.wheel from the original single-device
// public/juegos/ruleta-elimlldm.html so the online version feels identical.

export type WheelSegmentType = "puntos" | "bancarrota" | "pierde_turno";

export interface WheelSegment {
  type: WheelSegmentType;
  value: number;
  label: string;
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { type: "puntos", value: 300, label: "300" },
  { type: "puntos", value: 500, label: "500" },
  { type: "puntos", value: 600, label: "600" },
  { type: "puntos", value: 800, label: "800" },
  { type: "bancarrota", value: 0, label: "BANCARROTA" },
  { type: "puntos", value: 400, label: "400" },
  { type: "puntos", value: 700, label: "700" },
  { type: "puntos", value: 250, label: "250" },
  { type: "pierde_turno", value: 0, label: "PIERDE TURNO" },
  { type: "puntos", value: 900, label: "900" },
  { type: "puntos", value: 350, label: "350" },
  { type: "puntos", value: 650, label: "650" },
  { type: "puntos", value: 500, label: "500" },
  { type: "puntos", value: 450, label: "450" },
  { type: "puntos", value: 800, label: "800" },
  { type: "puntos", value: 300, label: "300" },
];

export const SEG_COLORS = [
  "#ff3d3d", "#ffd23f", "#3ddc84", "#3ec6ff", "#161616", "#ff8c1a",
  "#c651ff", "#1de9d0", "#ff3d9a", "#ff3d3d", "#ffd23f", "#3ddc84",
  "#3ec6ff", "#ff8c1a", "#c651ff", "#1de9d0",
];

export const VOWEL_COST = 700;
export const TURN_SECONDS = 15;
export const RESOLVE_BONUS = 500;
export const RONDA_FIN_SECONDS = 8; // cuánto se muestra la frase/ganador antes de pasar solo a la siguiente ronda
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const ROUNDS_MIN = 1;
export const ROUNDS_MAX = 15;
export const ROUNDS_DEFAULT = 5;

export function pickWheelSegmentIndex(): number {
  return Math.floor(Math.random() * WHEEL_SEGMENTS.length);
}

export const ALPHABET = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","Ñ","O",
  "P","Q","R","S","T","U","V","W","X","Y","Z",
];
export const VOWELS = ["A", "E", "I", "O", "U"];
