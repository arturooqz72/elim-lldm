// scripts/palabra/generar-seed.mjs
//
// Genera dos archivos a partir de palabras-seed.mjs:
//   1. supabase/migrations/0055_palabra_del_dia_seed.sql — una palabra por día
//      a partir de "hoy" en America/Los_Angeles (la fecha en que se aplique).
//   2. src/lib/palabra/validas.ts — lista de intentos válidos: todas las
//      palabras de 5 letras del diccionario "an-array-of-spanish-words"
//      (MIT, ~10.8k tras normalizar) + las respuestas del banco + nombres
//      bíblicos que el diccionario no trae.
//
// El diccionario NO es dependencia del proyecto (pesa ~10 MB); solo hace
// falta para regenerar la lista. Uso:
//   npm pack an-array-of-spanish-words@2.0.0 && tar xzf an-array-of-spanish-words-2.0.0.tgz
//   node scripts/palabra/generar-seed.mjs ruta/a/package/index.json
//
// Para regenerar solo el SQL (sin tocar validas.ts), omite el argumento.
import { readFileSync, writeFileSync } from "node:fs";
import { PALABRAS } from "./palabras-seed.mjs";

const normalizar = (s) =>
  s
    .toUpperCase()
    .replace(/Ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "Ñ");

const sqlStr = (s) => `'${s.replace(/'/g, "''")}'`;

// ---------- 1. Seed SQL ----------
const filas = PALABRAS.map(
  ([palabra, explicacion, referencia], i) =>
    `  (${i + 1}, ${sqlStr(palabra)}, ${sqlStr(explicacion)}, ${sqlStr(referencia)})`
).join(",\n");

const sql = `-- ============================================================
-- Elim LLDM — Palabra del Día: banco inicial (${PALABRAS.length} palabras)
--
-- GENERADO por scripts/palabra/generar-seed.mjs desde
-- scripts/palabra/palabras-seed.mjs — no editar a mano; cambia la fuente,
-- regenera y corre scripts/palabra/verificar-seed.mjs.
--
-- Asigna una palabra por día empezando HOY en America/Los_Angeles (la
-- misma zona que PALABRA_TZ en src/lib/palabra/config.ts), es decir, el
-- día en que se aplique esta migración. ON CONFLICT: si alguna fecha ya
-- tiene palabra (p. ej. agregada desde /admin/palabra), se respeta.
-- ============================================================

WITH hoy AS (
  SELECT (NOW() AT TIME ZONE 'America/Los_Angeles')::DATE AS d
)
INSERT INTO palabra_diaria (fecha, palabra, explicacion, referencia)
SELECT hoy.d + (v.orden - 1), v.palabra, v.explicacion, v.referencia
FROM hoy, (VALUES
${filas}
) AS v(orden, palabra, explicacion, referencia)
ON CONFLICT (fecha) DO NOTHING;
`;
writeFileSync("supabase/migrations/0055_palabra_del_dia_seed.sql", sql);
console.log(`SQL: ${PALABRAS.length} palabras`);

// ---------- 2. Lista de válidas ----------
const rutaDiccionario = process.argv[2];
if (rutaDiccionario) {
  // Nombres propios bíblicos de 5 letras que un diccionario común no trae.
  const EXTRA = [
    "JESUS", "ISAAC", "JACOB", "AARON", "JONAS", "NOEMI", "CALEB", "ELIAS", "NAHUM", "LUCAS",
    "SILAS", "FELIX", "ESTER", "JAIRO", "SARAI", "LABAN", "JETRO", "JOSUE", "NATAN", "URIAS",
    "EFESO", "SIDON", "SINAI", "HOREB", "BABEL", "EMAUS", "GOSEN", "HAGEO", "OSEAS", "JUDEA",
    "TARSO", "SALEM", "RAHAB", "JAFET", "RUBEN", "LIDIA", "DEMAS", "LOIDA", "MALCO", "SAULO",
    "TADEO", "ABIUD", "ABNER", "AMNON", "ASAFA", "BARAC", "BOOZ", "CEDAR", "CORAH", "DATAN",
    "ELCANA", "ENOCH", "ESDRA", "GALAAD", "HABAC", "HIRAM", "ISAIAS", "JABES", "JAVAN", "JOIADA",
    "LAMEC", "LEVIS", "MARCO", "MICAL", "MOLOC", "NABAL", "NABOT", "NADAB", "OBED", "ORPA",
    "SALOME", "SEFOR", "SELAH", "SIQUEM", "SUSAN", "TAMAR", "TITUS", "ZADOC", "ZERAH", "AGABO",
    "ANANI", "CAIFA", "DAVID", "PABLO", "PEDRO", "MATEO", "JUDAS", "TOMAS", "MARTA", "MARIA",
    "BELEN", "SIMON", "JUANA", "CESAR", "SIRIA", "CRETA", "MALTA", "AMOS", "ISRAEL", "JORAM",
    "JOSAFAT", "ACAZ", "OMRI", "SAMUEL", "ELISEO", "AGRIPA", "ANAS", "MAGOG", "GOLIAT", "EGLON",
  ];
  const diccionario = JSON.parse(readFileSync(rutaDiccionario, "utf8"));
  const validas = new Set();
  for (const w of [...diccionario, ...EXTRA, ...PALABRAS.map((p) => p[0])]) {
    const n = normalizar(w);
    if (/^[A-ZÑ]{5}$/.test(n)) validas.add(n);
  }
  const ordenadas = [...validas].sort();
  const lineas = [];
  for (let i = 0; i < ordenadas.length; i += 24) {
    lineas.push(`  "${ordenadas.slice(i, i + 24).join(" ")}",`);
  }
  const ts = `// src/lib/palabra/validas.ts
//
// GENERADO por scripts/palabra/generar-seed.mjs — no editar a mano.
// ${ordenadas.length} palabras de 5 letras en español, ya normalizadas
// (mayúsculas, sin acentos, con Ñ). Solo se usa en el servidor para
// validar intentos; nunca se manda al navegador (server-only).
import "server-only";

const BLOQUES = [
${lineas.join("\n")}
];

export const PALABRAS_VALIDAS: ReadonlySet<string> = new Set(BLOQUES.join(" ").split(" "));
`;
  writeFileSync("src/lib/palabra/validas.ts", ts);
  console.log(`Válidas: ${ordenadas.length}`);
}
