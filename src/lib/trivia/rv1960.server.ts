// src/lib/trivia/rv1960.server.ts
// Comprobación automática de citas contra el texto de la Reina-Valera 1960
// (bolls.life). La usa la generación semanal de preguntas: una pregunta
// solo se guarda si su palabra clave aparece en los versículos citados.
import "server-only";

export const LIBROS = [
  "Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio", "Josué", "Jueces", "Rut",
  "1 Samuel", "2 Samuel", "1 Reyes", "2 Reyes", "1 Crónicas", "2 Crónicas", "Esdras",
  "Nehemías", "Ester", "Job", "Salmos", "Proverbios", "Eclesiastés", "Cantares", "Isaías",
  "Jeremías", "Lamentaciones", "Ezequiel", "Daniel", "Oseas", "Joel", "Amós", "Abdías",
  "Jonás", "Miqueas", "Nahúm", "Habacuc", "Sofonías", "Hageo", "Zacarías", "Malaquías",
  "Mateo", "Marcos", "Lucas", "Juan", "Hechos", "Romanos", "1 Corintios", "2 Corintios",
  "Gálatas", "Efesios", "Filipenses", "Colosenses", "1 Tesalonicenses", "2 Tesalonicenses",
  "1 Timoteo", "2 Timoteo", "Tito", "Filemón", "Hebreos", "Santiago", "1 Pedro", "2 Pedro",
  "1 Juan", "2 Juan", "3 Juan", "Judas", "Apocalipsis",
];

/** Minúsculas, sin acentos ni signos: para comparar textos. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Cita {
  libro: number;
  capitulo: number;
  desde: number;
  hasta: number;
}

/** "Juan 3:16" o "1 Reyes 18:19-21" (un solo capítulo). */
export function leerCita(cita: string): Cita | null {
  const m = cita.trim().match(/^(.+?) (\d+):(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const libro = LIBROS.indexOf(m[1]) + 1;
  if (!libro) return null;
  const desde = Number(m[3]);
  const hasta = Number(m[4] ?? m[3]);
  if (hasta < desde || hasta - desde > 30) return null;
  return { libro, capitulo: Number(m[2]), desde, hasta };
}

const capitulos = new Map<string, Promise<{ verse: number; text: string }[] | null>>();

function bajarCapitulo(libro: number, capitulo: number) {
  const clave = `${libro}:${capitulo}`;
  let p = capitulos.get(clave);
  if (!p) {
    p = fetch(`https://bolls.life/get-text/RV1960/${libro}/${capitulo}/`, {
      signal: AbortSignal.timeout(15_000),
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ verse: number; text: string }[]>) : null))
      .catch(() => null)
      .then((versos) => {
        // Un fallo de red no se queda guardado: el siguiente intento vuelve a pedirlo.
        if (!versos) capitulos.delete(clave);
        return versos;
      });
    capitulos.set(clave, p);
  }
  return p;
}

/**
 * true si cada parte de `clave` (separadas por "+") aparece en los
 * versículos citados de la RV1960. null si no se pudo consultar el texto.
 */
export async function claveEnCita(cita: string, clave: string): Promise<boolean | null> {
  const c = leerCita(cita);
  if (!c) return false;
  const versos = await bajarCapitulo(c.libro, c.capitulo);
  if (!versos) return null;
  const texto = normalizar(
    versos.filter((v) => v.verse >= c.desde && v.verse <= c.hasta).map((v) => v.text).join(" ")
  );
  if (!texto) return false;
  return clave
    .split("+")
    .map(normalizar)
    .filter(Boolean)
    .every((parte) => texto.includes(parte));
}
