// scripts/palabra/verificar-seed.mjs
//
// Verifica el banco inicial de "Palabra del Día":
//   - cada palabra tiene exactamente 5 letras (con acentos normalizados, Ñ cuenta como una)
//   - ninguna se repite (comparando ya normalizadas: JESÚS == JESUS)
//   - cada fila tiene explicación y referencia
//   - el SQL generado (0055) contiene exactamente las mismas palabras
//   - todas las respuestas están en la lista de palabras válidas
//
// Uso (desde la raíz del repo):  node scripts/palabra/verificar-seed.mjs
import { readFileSync } from "node:fs";
import { PALABRAS } from "./palabras-seed.mjs";

const MINIMO = 120;
const normalizar = (s) =>
  s
    .toUpperCase()
    .replace(/Ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "Ñ");

const errores = [];
const vistas = new Map();

PALABRAS.forEach(([palabra, explicacion, referencia], i) => {
  const n = normalizar(palabra);
  if (!/^[A-ZÑ]{5}$/.test(n)) errores.push(`#${i + 1} "${palabra}" no tiene exactamente 5 letras (${n.length})`);
  if (!/^[A-ZÁÉÍÓÚÜÑ]{5}$/.test(palabra)) errores.push(`#${i + 1} "${palabra}" tiene caracteres no permitidos`);
  if (vistas.has(n)) errores.push(`#${i + 1} "${palabra}" repetida (ya en #${vistas.get(n)})`);
  vistas.set(n, i + 1);
  if (!explicacion?.trim()) errores.push(`#${i + 1} "${palabra}" sin explicación`);
  if (!referencia?.trim()) errores.push(`#${i + 1} "${palabra}" sin referencia`);
});

if (PALABRAS.length < MINIMO) errores.push(`Solo hay ${PALABRAS.length} palabras (mínimo ${MINIMO})`);

// El SQL generado debe coincidir con la fuente.
const sql = readFileSync("supabase/migrations/0055_palabra_del_dia_seed.sql", "utf8");
const enSql = [...sql.matchAll(/^\s*\(\d+, '([^']+)'/gm)].map((m) => m[1]);
if (enSql.length !== PALABRAS.length) {
  errores.push(`El SQL tiene ${enSql.length} palabras y la fuente ${PALABRAS.length} — regenera con generar-seed.mjs`);
} else {
  enSql.forEach((p, i) => {
    if (p !== PALABRAS[i][0]) errores.push(`SQL fila ${i + 1}: "${p}" ≠ fuente "${PALABRAS[i][0]}"`);
  });
}

// Toda respuesta debe ser aceptada como intento.
const validasTs = readFileSync("src/lib/palabra/validas.ts", "utf8");
const validas = new Set((validasTs.match(/"([A-ZÑ ]+)"/g) ?? []).flatMap((s) => s.slice(1, -1).split(" ")));
for (const [palabra] of PALABRAS) {
  if (!validas.has(normalizar(palabra))) errores.push(`"${palabra}" no está en src/lib/palabra/validas.ts`);
}

if (errores.length) {
  console.error(`✗ ${errores.length} problema(s):`);
  for (const e of errores) console.error("  - " + e);
  process.exit(1);
}
console.log(`✓ ${PALABRAS.length} palabras: todas de 5 letras, sin repetir, con explicación y referencia, SQL y lista de válidas sincronizados.`);
