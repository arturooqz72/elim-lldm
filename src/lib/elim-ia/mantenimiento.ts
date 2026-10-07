// src/lib/elim-ia/mantenimiento.ts
// Modo mantenimiento de Elim IA. Con ELIM_IA_MAINTENANCE="true" la ruta
// /api/elim-ia/chat responde sin llamar a Anthropic y la página muestra un
// aviso en lugar del chat. Cualquier otro valor (o sin definir) = normal.
// Solo servidor: el layout público pasa el valor al menú como prop.

export const MENSAJE_MANTENIMIENTO =
  "Elim IA está en mantenimiento. Volveremos pronto. Mientras tanto, puedes practicar inglés en Elim English.";

export function elimIaEnMantenimiento(): boolean {
  return process.env.ELIM_IA_MAINTENANCE === "true";
}
