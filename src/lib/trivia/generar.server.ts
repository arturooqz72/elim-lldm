// src/lib/trivia/generar.server.ts
// Revisión semanal del banco de preguntas (cron /api/cron/banco-preguntas,
// o el botón "Revisar ahora" del panel). Si quedan menos de 100 preguntas
// que la mayoría de los jugadores activos no ha visto, genera 100 nuevas
// con las mismas reglas del banco inicial, las comprueba contra la RV1960
// y las deja como "pendiente": no salen en ningún juego hasta que un admin
// las apruebe en /admin/banco-preguntas.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { BANCO_SET_ID, CATEGORIAS, CATEGORIA_LABEL, NIVELES, NIVEL_LABEL, esCategoria, esNivel } from "./banco";
import type { Categoria, Nivel } from "./banco";
import { revolver } from "./banco.server";
import { claveEnCita, LIBROS, normalizar } from "./rv1960.server";

const MINIMO_FRESCAS = 100;
const A_GENERAR = 100;
const POR_LLAMADA = 25;
const DIAS_ACTIVO = 30;
const MODELO = "claude-opus-5-5";
const LETRAS = ["a", "b", "c", "d"] as const;

export interface ResultadoRevision {
  mensaje: string;
  error?: string;
  generadas: number;
}

interface Propuesta {
  pregunta: string;
  correcta: string;
  distractores: string[];
  cita: string;
  clave: string;
  nivel: string;
  categoria: string;
}

const SISTEMA = `Eres un maestro de la Biblia que escribe preguntas de trivia bíblica en español para una congregación de La Luz del Mundo. Usas siempre la Reina-Valera 1960.

Reglas de cada pregunta:
- Opción múltiple con exactamente 4 opciones: 1 correcta y 3 distractores.
- Una sola respuesta correcta, sin ninguna ambigüedad: ningún distractor puede ser también verdadero según la Biblia, ni siquiera en otro pasaje.
- Nada de "todas las anteriores", "ninguna" ni preguntas en negativo.
- Las 4 opciones del mismo tipo y de largo parecido. Sin opciones repetidas.
- La cita es de UN solo capítulo, con este formato exacto: "Libro capítulo:versículo" o "Libro capítulo:versículo-versículo". El libro se escribe exactamente como en esta lista: ${LIBROS.join(", ")}.
- "clave": una frase corta (1 a 6 palabras) copiada LITERALMENTE del texto de la Reina-Valera 1960 en esos versículos, que confirme la respuesta correcta. Si necesitas dos frases, sepáralas con "+".
- Niveles: "facil" = historias y datos que conoce cualquier creyente; "normal" = requiere haber leído la Biblia; "dificil" = detalles precisos (nombres poco conocidos, números, lugares).
- No repitas ninguna de las preguntas que ya existen (ni con otras palabras).

Responde SOLO con un arreglo JSON, sin texto antes ni después. Cada elemento:
{"pregunta": "...", "correcta": "...", "distractores": ["...", "...", "..."], "cita": "...", "clave": "...", "nivel": "facil|normal|dificil", "categoria": "${CATEGORIAS.join("|")}"}`;

/** Reparte `total` preguntas entre niveles y categorías lo más parejo posible. */
function repartir(total: number): { nivel: Nivel; categoria: Categoria }[] {
  const lista: { nivel: Nivel; categoria: Categoria }[] = [];
  for (let i = 0; i < total; i++) {
    lista.push({ nivel: NIVELES[i % NIVELES.length], categoria: CATEGORIAS[i % CATEGORIAS.length] });
  }
  return lista;
}

async function pedirPropuestas(
  encargo: { nivel: Nivel; categoria: Categoria }[],
  existentes: string[]
): Promise<{ propuestas: Propuesta[]; uso: UsoModelo }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY");

  const cuenta = new Map<string, number>();
  for (const e of encargo) {
    const k = `${NIVEL_LABEL[e.nivel]} — ${CATEGORIA_LABEL[e.categoria]} (nivel "${e.nivel}", categoría "${e.categoria}")`;
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }
  const pedido = [...cuenta].map(([k, n]) => `- ${n} de ${k}`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 12000,
      system: SISTEMA,
      messages: [
        {
          role: "user",
          content: `Escribe ${encargo.length} preguntas nuevas:\n${pedido}\n\nPreguntas que YA existen (no las repitas):\n${existentes.join("\n")}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(240_000),
  });

  if (!res.ok) throw new Error(`Anthropic respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const uso = { entrada: data.usage?.input_tokens ?? 0, salida: data.usage?.output_tokens ?? 0 };
  const textoRespuesta = data.content.map((b) => (b.type === "text" ? (b.text ?? "") : "")).join("");
  const inicio = textoRespuesta.indexOf("[");
  const fin = textoRespuesta.lastIndexOf("]");
  if (inicio < 0 || fin < inicio) throw new Error("La respuesta del modelo no trae un arreglo JSON");
  const lista = JSON.parse(textoRespuesta.slice(inicio, fin + 1)) as unknown[];
  const propuestas = lista.filter((p): p is Propuesta => {
    const q = p as Partial<Propuesta>;
    return (
      typeof q.pregunta === "string" &&
      typeof q.correcta === "string" &&
      Array.isArray(q.distractores) &&
      q.distractores.length === 3 &&
      q.distractores.every((d) => typeof d === "string") &&
      typeof q.cita === "string" &&
      typeof q.clave === "string" &&
      typeof q.nivel === "string" &&
      typeof q.categoria === "string"
    );
  });
  return { propuestas, uso };
}

export async function revisarBanco(): Promise<ResultadoRevision> {
  const service = await createServiceClient();

  const { data: frescasData, error: frescasError } = await service.rpc("banco_preguntas_frescas", {
    p_dias: DIAS_ACTIVO,
  });
  if (frescasError) return { mensaje: "", error: frescasError.message, generadas: 0 };
  const fila = ((frescasData ?? []) as { jugadores_activos: number; preguntas_frescas: number }[])[0];
  const activos = fila?.jugadores_activos ?? 0;
  const frescas = fila?.preguntas_frescas ?? 0;

  if (frescas >= MINIMO_FRESCAS) {
    return {
      mensaje: `El banco está bien: ${frescas} preguntas que la mayoría de los ${activos} jugadores activos no ha visto. No se generó nada.`,
      generadas: 0,
    };
  }

  // Si ya hay un lote esperando revisión, no se genera otro encima.
  const { count: pendientes } = await service
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");
  if ((pendientes ?? 0) >= A_GENERAR) {
    return {
      mensaje: `Quedan ${frescas} preguntas frescas, pero ya hay ${pendientes} pendientes de revisión. Apruébalas para que entren al juego.`,
      generadas: 0,
    };
  }

  const g = await generarPendientes(A_GENERAR);
  if (g.error) return { mensaje: "", error: g.error, generadas: 0 };

  const mensaje =
    `Quedaban ${frescas} preguntas frescas (${activos} jugadores activos). ` +
    `Se generaron ${g.aceptadas.length} nuevas, pendientes de tu revisión` +
    (g.descartadas.length > 0
      ? `; ${g.descartadas.length} se descartaron por no pasar la verificación con la RV1960 o por repetidas`
      : "") +
    (g.llamadasFallidas > 0 ? `; ${g.llamadasFallidas} de ${g.llamadas} llamadas al modelo fallaron` : "") +
    ".";
  return g.aceptadas.length === 0 && g.llamadasFallidas > 0
    ? { mensaje: "", error: mensaje, generadas: 0 }
    : { mensaje, generadas: g.aceptadas.length };
}

export interface UsoModelo {
  entrada: number;
  salida: number;
}

export interface ResultadoGeneracion {
  aceptadas: { pregunta: string; correcta: string; cita: string; nivel: string; categoria: string }[];
  descartadas: { pregunta: string; cita: string; clave: string; motivo: string }[];
  llamadas: number;
  llamadasFallidas: number;
  uso: UsoModelo;
  modelo: string;
  error?: string;
}

/**
 * Pide `cantidad` preguntas al modelo, las comprueba (formato, repetidas,
 * clave contra la RV1960) y guarda las que pasan como "pendiente". No mira
 * el umbral del banco: eso lo decide revisarBanco().
 */
export async function generarPendientes(cantidad: number): Promise<ResultadoGeneracion> {
  const service = await createServiceClient();
  const uso: UsoModelo = { entrada: 0, salida: 0 };

  // Todas las preguntas que ya existen (de 1000 en 1000, el tope de la API).
  const existentes: string[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data: pagina } = await service
      .from("questions")
      .select("question_text")
      .order("id")
      .range(desde, desde + 999);
    const textos = ((pagina ?? []) as { question_text: string }[]).map((q) => q.question_text);
    existentes.push(...textos);
    if (textos.length < 1000) break;
  }
  const vistas = new Set(existentes.map(normalizar));

  const reparto = revolver(repartir(cantidad));
  const lotes: { nivel: Nivel; categoria: Categoria }[][] = [];
  for (let i = 0; i < reparto.length; i += POR_LLAMADA) lotes.push(reparto.slice(i, i + POR_LLAMADA));

  const resultados = await Promise.allSettled(lotes.map((lote) => pedirPropuestas(lote, existentes)));
  const propuestas: Propuesta[] = [];
  let llamadasFallidas = 0;
  for (const r of resultados) {
    if (r.status === "fulfilled") {
      propuestas.push(...r.value.propuestas);
      uso.entrada += r.value.uso.entrada;
      uso.salida += r.value.uso.salida;
    } else {
      llamadasFallidas++;
      console.error("[trivia/generar] Falló una llamada al modelo:", r.reason);
    }
  }

  const descartadas: ResultadoGeneracion["descartadas"] = [];
  const aceptadas: Propuesta[] = [];
  for (const p of propuestas.slice(0, cantidad)) {
    const opciones = [p.correcta, ...p.distractores].map((o) => o.trim());
    let motivo = "";
    if (!esNivel(p.nivel) || !esCategoria(p.categoria)) motivo = "nivel o categoría no válidos";
    else if (!opciones.every((o) => o.length > 0 && o.length <= 200) || p.pregunta.length > 400) motivo = "textos vacíos o demasiado largos";
    else if (new Set(opciones.map(normalizar)).size !== 4) motivo = "opciones repetidas";
    else if (vistas.has(normalizar(p.pregunta))) motivo = "pregunta repetida";
    else {
      const enCita = await claveEnCita(p.cita, p.clave);
      if (enCita === null) motivo = "no se pudo consultar el texto de la RV1960";
      else if (!enCita) motivo = "la clave no aparece en la cita de la RV1960";
    }
    if (motivo) {
      descartadas.push({ pregunta: p.pregunta, cita: p.cita, clave: p.clave, motivo });
      continue;
    }
    vistas.add(normalizar(p.pregunta));
    aceptadas.push(p);
  }

  if (aceptadas.length > 0) {
    const { data: ultima } = await service
      .from("questions")
      .select("order_index")
      .eq("question_set_id", BANCO_SET_ID)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const base = ((ultima?.order_index as number | undefined) ?? -1) + 1;

    const { error: insertError } = await service.from("questions").insert(
      aceptadas.map((p, i) => {
        const pos = Math.floor(Math.random() * 4);
        const opciones = p.distractores.map((d) => d.trim());
        opciones.splice(pos, 0, p.correcta.trim());
        return {
          question_set_id: BANCO_SET_ID,
          question_text: p.pregunta.trim(),
          option_a: opciones[0],
          option_b: opciones[1],
          option_c: opciones[2],
          option_d: opciones[3],
          correct_option: LETRAS[pos],
          bible_reference: p.cita.trim(),
          dificultad: p.nivel,
          categoria: p.categoria,
          estado: "pendiente",
          origen: "generada",
          order_index: base + i,
        };
      })
    );
    if (insertError) {
      return { aceptadas: [], descartadas, llamadas: lotes.length, llamadasFallidas, uso, modelo: MODELO, error: insertError.message };
    }
  }

  return {
    aceptadas: aceptadas.map((p) => ({ pregunta: p.pregunta, correcta: p.correcta, cita: p.cita, nivel: p.nivel, categoria: p.categoria })),
    descartadas,
    llamadas: lotes.length,
    llamadasFallidas,
    uso,
    modelo: MODELO,
    error: aceptadas.length === 0 && llamadasFallidas === lotes.length ? "Todas las llamadas al modelo fallaron" : undefined,
  };
}
