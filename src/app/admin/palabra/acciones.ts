// src/app/admin/palabra/acciones.ts
//
// Server Actions de /admin/palabra (agregar, editar, reordenar y eliminar
// palabras). Separadas de page.tsx para que la página no pase de 300 líneas.
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { esCategoria, esFechaIso, normalizarPalabra, sumarDias, tieneFormatoValido } from "@/lib/palabra/logica";
import { buscarLibro } from "@/lib/palabra/libros";
import { fechaDeHoy } from "@/lib/palabra/servidor";
import type { PalabraDiaria } from "@/types";

const RUTA = "/admin/palabra";

// El layout de /admin ya exige rol admin, pero una Server Action se puede
// invocar por POST directo: se vuelve a verificar aquí (regla del blueprint).
async function exigirAdmin() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/");
}

function volver(params: Record<string, string>): never {
  revalidatePath(RUTA);
  redirect(`${RUTA}?${new URLSearchParams(params).toString()}`);
}

export async function guardarPalabra(formData: FormData) {
  await exigirAdmin();
  const hoy = fechaDeHoy();
  const id = ((formData.get("id") as string) || "").trim();
  const fecha = ((formData.get("fecha") as string) || "").trim();
  const palabra = ((formData.get("palabra") as string) || "").trim().toUpperCase();
  const explicacion = ((formData.get("explicacion") as string) || "").trim();
  const referencia = ((formData.get("referencia") as string) || "").trim();
  const categoria = ((formData.get("categoria") as string) || "").trim();
  const libro = ((formData.get("libro") as string) || "").trim();
  const capitulo = Number(formData.get("capitulo"));

  if (!esFechaIso(fecha)) volver({ error: "Fecha inválida." });
  if (!/^[A-ZÁÉÍÓÚÜÑ]{5}$/.test(palabra) || !tieneFormatoValido(normalizarPalabra(palabra))) {
    volver({ error: "La palabra debe tener exactamente 5 letras (puede llevar acentos y Ñ)." });
  }
  if (!explicacion || explicacion.length > 200) volver({ error: "La explicación es obligatoria (máx. 200 caracteres)." });
  if (!referencia || referencia.length > 60) volver({ error: "La referencia es obligatoria (máx. 60 caracteres)." });
  if (!esCategoria(categoria)) volver({ error: "Elige la categoría de la palabra." });
  const datosLibro = buscarLibro(libro);
  if (!datosLibro) volver({ error: "Elige el libro de la Biblia donde aparece la palabra." });
  if (!Number.isInteger(capitulo) || capitulo < 1 || capitulo > datosLibro!.capitulos) {
    volver({ error: `${libro} tiene ${datosLibro!.capitulos} capítulos: el capítulo debe estar entre 1 y ${datosLibro!.capitulos}.` });
  }

  const supabase = await createServiceClient();

  let fechaOriginal: string | null = null;
  if (id) {
    const { data: actual } = await supabase.from("palabra_diaria").select("fecha, palabra").eq("id", id).maybeSingle();
    if (!actual) volver({ error: "Esa palabra ya no existe." });
    const original = actual as { fecha: string; palabra: string };
    fechaOriginal = original.fecha;
    // Hoy y días pasados ya se jugaron (o se están jugando): solo se puede
    // corregir la explicación y la referencia, nunca la palabra ni la fecha.
    if (original.fecha <= hoy && (fecha !== original.fecha || palabra !== original.palabra)) {
      volver({ error: "La palabra de hoy o de días pasados no se puede cambiar ni mover; solo su explicación, referencia y pistas." });
    }
  }
  if (fecha < hoy && fecha !== fechaOriginal) volver({ error: "No se pueden programar palabras en días pasados." });

  // Aviso de repetida: misma palabra (sin acentos) en otra fecha del último año o futura.
  const { data: recientes } = await supabase
    .from("palabra_diaria")
    .select("id, fecha, palabra")
    .gte("fecha", sumarDias(hoy, -365));
  const repetida = ((recientes ?? []) as Array<{ id: string; fecha: string; palabra: string }>).find(
    (p) => p.id !== id && normalizarPalabra(p.palabra) === normalizarPalabra(palabra)
  );
  if (repetida) volver({ error: `${palabra} ya está programada el ${repetida.fecha}.` });

  const fila = { fecha, palabra, explicacion, referencia, categoria, libro, capitulo, updated_at: new Date().toISOString() };
  const { error } = id
    ? await supabase.from("palabra_diaria").update(fila).eq("id", id)
    : await supabase.from("palabra_diaria").insert(fila);
  if (error) {
    volver({ error: error.code === "23505" ? `Ya hay una palabra el ${fecha}.` : error.message });
  }
  volver({ ok: id ? `Guardado: ${palabra}` : `Agregada: ${palabra} (${fecha})` });
}

export async function moverPalabra(formData: FormData) {
  await exigirAdmin();
  const hoy = fechaDeHoy();
  const id = formData.get("id") as string;
  const direccion = formData.get("direccion") === "arriba" ? "arriba" : "abajo";
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("palabra_diaria")
    .select("id, fecha, palabra, explicacion, referencia, categoria, libro, capitulo")
    .gt("fecha", hoy)
    .order("fecha", { ascending: true });
  type Contenido = "palabra" | "explicacion" | "referencia" | "categoria" | "libro" | "capitulo";
  const futuras = (data ?? []) as Array<Pick<PalabraDiaria, "id" | "fecha" | Contenido>>;
  const i = futuras.findIndex((p) => p.id === id);
  const j = direccion === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= futuras.length) volver({ error: "Solo se pueden reordenar palabras de días futuros." });

  // Intercambia el CONTENIDO entre las dos fechas (no las fechas), así no
  // choca con el UNIQUE de fecha ni hace falta una fecha temporal.
  const [a, b] = [futuras[i], futuras[j]];
  const ahora = new Date().toISOString();
  // Las pistas viajan con su palabra.
  const contenido = ({ palabra, explicacion, referencia, categoria, libro, capitulo }: (typeof futuras)[number]) => ({
    palabra,
    explicacion,
    referencia,
    categoria,
    libro,
    capitulo,
    updated_at: ahora,
  });
  const r1 = await supabase.from("palabra_diaria").update(contenido(b)).eq("id", a.id);
  const r2 = await supabase.from("palabra_diaria").update(contenido(a)).eq("id", b.id);
  if (r1.error || r2.error) volver({ error: (r1.error ?? r2.error)!.message });
  volver({ ok: `${a.palabra} ⇄ ${b.palabra}` });
}

export async function eliminarPalabra(formData: FormData) {
  await exigirAdmin();
  const hoy = fechaDeHoy();
  const id = formData.get("id") as string;
  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("palabra_diaria").delete().eq("id", id).gt("fecha", hoy).select("palabra");
  if (error) volver({ error: error.message });
  if (!data || data.length === 0) volver({ error: "Solo se pueden eliminar palabras de días futuros." });
  volver({ ok: `Eliminada: ${(data[0] as { palabra: string }).palabra}` });
}
