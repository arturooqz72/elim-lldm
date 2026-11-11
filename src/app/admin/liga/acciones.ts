// src/app/admin/liga/acciones.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { adminId } from "@/lib/videos/categorias.server";
import { claveIglesia, limpiar } from "@/lib/liga/nombre";
import { esDenominacion } from "@/lib/liga/config";

function volver(error?: string): never {
  revalidatePath("/admin/liga");
  revalidatePath("/juegos/liga");
  redirect(error ? `/admin/liga?error=${encodeURIComponent(error)}` : "/admin/liga");
}

async function soloAdmin() {
  if (!(await adminId())) volver("Solo un administrador puede hacer esto");
}

export async function aprobarIglesia(formData: FormData) {
  await soloAdmin();
  const service = await createServiceClient();
  const { error } = await service.from("iglesias").update({ aprobada: true }).eq("id", String(formData.get("id") ?? ""));
  volver(error?.message);
}

/** Rechazar una pendiente: sus jugadores quedan sin equipo (les vuelve a salir el aviso). */
export async function rechazarIglesia(formData: FormData) {
  await soloAdmin();
  const id = String(formData.get("id") ?? "");
  const service = await createServiceClient();
  const { error: e1 } = await service.from("profiles").update({ iglesia_id: null, iglesia_preguntada: false }).eq("iglesia_id", id);
  if (e1) volver(e1.message);
  const { error } = await service.from("iglesias").delete().eq("id", id).eq("aprobada", false).neq("comunidad", "amigos");
  volver(error?.message);
}

export async function juntarIglesias(formData: FormData) {
  await soloAdmin();
  const conservar = String(formData.get("conservar") ?? "");
  if (!conservar) volver("Elige con cuál equipo juntarlo");
  const service = await createServiceClient();
  const { error } = await service.rpc("liga_juntar_iglesias", { p_conservar: conservar, p_quitar: String(formData.get("id") ?? "") });
  volver(error?.message);
}

export async function editarIglesia(formData: FormData) {
  await soloAdmin();
  const id = String(formData.get("id") ?? "");
  const comunidad = String(formData.get("comunidad") ?? "");
  const ciudad = limpiar(String(formData.get("ciudad") ?? ""));
  const estado = limpiar(String(formData.get("estado") ?? ""));
  const pais = limpiar(String(formData.get("pais") ?? ""));
  const den = comunidad === "otra" ? String(formData.get("denominacion") ?? "") : null;
  if (comunidad !== "lldm" && comunidad !== "otra") volver("Este equipo no se edita");
  if (comunidad === "otra" && !esDenominacion(den)) volver("Elige una denominación de la lista");
  if (!ciudad || !estado || !pais) volver("Ciudad, estado y país son obligatorios");
  const service = await createServiceClient();
  const { error } = await service
    .from("iglesias")
    .update({ denominacion: den, ciudad, estado, pais, clave: claveIglesia(comunidad as "lldm" | "otra", den, ciudad, estado, pais) })
    .eq("id", id)
    .neq("comunidad", "amigos");
  volver(error ? (error.code === "23505" ? "Ya existe otro equipo igual" : error.message) : undefined);
}
