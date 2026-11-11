// src/lib/reglas.ts
//
// Regla general de participación. Si cambia el texto, se sube la versión y
// a todos se les vuelve a pedir "Acepto" una vez.
export const REGLAS_VERSION = "2026-11-11";

export const TEXTO_REGLA_PARTICIPACION =
  "Al participar en los juegos de Elim LLDM aceptas que tu nombre para mostrar y tu foto de perfil puedan aparecer en la Liga, en las tablas de resultados y en los videos de Elim LLDM en redes sociales.";

export const NOTA_NOMBRE_PARA_MOSTRAR = "Este es el nombre que verán los demás y que puede salir en los videos";

export const TEXTO_PARA_TODOS =
  "Elim LLDM es para todos. No importa tu iglesia o denominación, todos son bienvenidos a jugar y participar.";

export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 60;

export function aceptoVersionActual(version: string | null | undefined): boolean {
  return version === REGLAS_VERSION;
}
