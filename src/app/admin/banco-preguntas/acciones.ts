// src/app/admin/banco-preguntas/acciones.ts
//
// Server Actions de /admin/banco-preguntas: agregar y editar preguntas,
// activarlas o desactivarlas, aprobar o rechazar las generadas cada semana
// y lanzar a mano la revisión semanal del banco.
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { BANCO_SET_ID, esCategoria, esNivel } from "@/lib/trivia/banco";
import { revisarBanco } from "@/lib/trivia/generar.server";

const RUTA = "/admin/banco-preguntas";
const LETRAS = ["a", "b", "c", "d"];

// El layout de /admin ya exige rol admin, pero una Server Action se puede
// invocar por POST directo: se vuelve a verificar aquí (regla del blueprint).
async function exigirAdmin() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/");
}

/** Vuelve a la lista con los mismos filtros, más un aviso de éxito o error. */
function volver(formData: FormData, aviso: { ok?: string; error?: string }): never {
  const filtros = new URLSearchParams(((formData.get("filtros") as string) || "").replace(/^\?/, ""));
  filtros.delete("ok");
  filtros.delete("error");
  if (aviso.ok) filtros.set("ok", aviso.ok);
  if (aviso.error) filtros.set("error", aviso.error);
  revalidatePath(RUTA);
  redirect(`${RUTA}?${filtros.toString()}`);
}

const texto = (formData: FormData, campo: string) => ((formData.get(campo) as string) || "").trim();
const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

export async function guardarPregunta(formData: FormData) {
  await exigirAdmin();

  const id = texto(formData, "id");
  const pregunta = texto(formData, "question_text");
  const opciones = LETRAS.map((l) => texto(formData, `option_${l}`));
  const correcta = texto(formData, "correct_option");
  const cita = texto(formData, "bible_reference");
  const dificultad = texto(formData, "dificultad");
  const categoria = texto(formData, "categoria");

  if (!pregunta || opciones.some((o) => !o) || !cita) {
    volver(formData, { error: "Completa la pregunta, las 4 opciones y la cita bíblica." });
  }
  if (pregunta.length > 400 || opciones.some((o) => o.length > 200) || cita.length > 100) {
    volver(formData, { error: "La pregunta, las opciones o la cita son demasiado largas." });
  }
  if (new Set(opciones.map(normalizar)).size !== 4) {
    volver(formData, { error: "Las 4 opciones deben ser distintas." });
  }
  if (!LETRAS.includes(correcta)) volver(formData, { error: "Marca cuál es la respuesta correcta." });
  if (!esNivel(dificultad)) volver(formData, { error: "Elige el nivel." });
  if (!esCategoria(categoria)) volver(formData, { error: "Elige la categoría." });

  const service = await createServiceClient();

  // Sin preguntas repetidas en el banco (mismo texto, sin contar acentos ni signos).
  const { data: parecidas } = await service
    .from("questions")
    .select("id, question_text")
    .ilike("question_text", `%${pregunta.slice(0, 40).replace(/[%_]/g, "")}%`);
  const repetida = (parecidas ?? []).find(
    (p) => p.id !== id && normalizar(p.question_text as string) === normalizar(pregunta)
  );
  if (repetida) volver(formData, { error: "Ya existe una pregunta con ese mismo texto." });

  const campos = {
    question_text: pregunta,
    option_a: opciones[0],
    option_b: opciones[1],
    option_c: opciones[2],
    option_d: opciones[3],
    correct_option: correcta,
    bible_reference: cita,
    dificultad,
    categoria,
  };

  if (id) {
    const { error } = await service.from("questions").update(campos).eq("id", id);
    if (error) volver(formData, { error: `No se pudo guardar: ${error.message}` });
    volver(formData, { ok: "Pregunta actualizada." });
  }

  const { data: ultima } = await service
    .from("questions")
    .select("order_index")
    .eq("question_set_id", BANCO_SET_ID)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await service.from("questions").insert({
    ...campos,
    question_set_id: BANCO_SET_ID,
    estado: "aprobada",
    origen: "manual",
    order_index: ((ultima?.order_index as number | undefined) ?? -1) + 1,
  });
  if (error) volver(formData, { error: `No se pudo agregar: ${error.message}` });
  volver(formData, { ok: "Pregunta agregada al banco." });
}

export async function cambiarActiva(formData: FormData) {
  await exigirAdmin();
  const id = texto(formData, "id");
  const activa = texto(formData, "activa") === "true";
  if (!id) volver(formData, { error: "Falta la pregunta." });

  const service = await createServiceClient();
  const { error } = await service.from("questions").update({ activa }).eq("id", id);
  if (error) volver(formData, { error: `No se pudo cambiar: ${error.message}` });
  volver(formData, { ok: activa ? "Pregunta activada." : "Pregunta desactivada: ya no sale en los juegos." });
}

export async function revisarPendiente(formData: FormData) {
  await exigirAdmin();
  const id = texto(formData, "id");
  const decision = texto(formData, "decision");
  if (!id || (decision !== "aprobar" && decision !== "rechazar")) {
    volver(formData, { error: "Acción no válida." });
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("questions")
    .update({ estado: decision === "aprobar" ? "aprobada" : "rechazada" })
    .eq("id", id)
    .eq("estado", "pendiente");
  if (error) volver(formData, { error: `No se pudo guardar: ${error.message}` });
  volver(formData, {
    ok: decision === "aprobar" ? "Aprobada: ya puede salir en los juegos." : "Rechazada: no saldrá en los juegos.",
  });
}

export async function revisarBancoAhora(formData: FormData) {
  await exigirAdmin();
  const resultado = await revisarBanco();
  volver(formData, resultado.error ? { error: resultado.error } : { ok: resultado.mensaje });
}
