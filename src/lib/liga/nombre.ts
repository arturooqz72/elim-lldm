// src/lib/liga/nombre.ts
//
// Nombre de cada equipo de la Liga:
// - lldm   → "Iglesia de [Ciudad]" (SOLO para la Iglesia La Luz del Mundo)
// - otra   → "[Denominación] · [Ciudad]"
// - amigos → "Amigos de Elim"
// Si otro equipo aprobado del mismo tipo tiene la misma ciudad, se agrega
// el estado; si también coincide el estado, el país. Nunca "congregación".

export type Comunidad = "lldm" | "otra" | "amigos";

export interface IglesiaBase {
  id: string;
  comunidad: Comunidad;
  denominacion: string | null;
  ciudad: string | null;
  estado: string | null;
  pais: string | null;
}

export const COLUMNAS_IGLESIA = "id, comunidad, denominacion, ciudad, estado, pais";
export const NOMBRE_AMIGOS = "Amigos de Elim";

export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function limpiar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** Debe dar lo mismo que las claves escritas a mano en 0086. */
export function claveIglesia(
  comunidad: Exclude<Comunidad, "amigos">,
  denominacion: string | null,
  ciudad: string,
  estado: string,
  pais: string
): string {
  return [comunidad, normalizar(denominacion), normalizar(ciudad), normalizar(estado), normalizar(pais)].join("|");
}

function mismoTipo(a: IglesiaBase, b: IglesiaBase): boolean {
  return a.comunidad === b.comunidad && normalizar(a.denominacion) === normalizar(b.denominacion);
}

/** `aprobadas` = todos los equipos aprobados (para detectar ciudades repetidas). */
export function nombreIglesia(ig: IglesiaBase, aprobadas: IglesiaBase[]): string {
  if (ig.comunidad === "amigos") return NOMBRE_AMIGOS;
  const base = ig.comunidad === "lldm" ? `Iglesia de ${ig.ciudad}` : `${ig.denominacion} · ${ig.ciudad}`;
  const ciudad = normalizar(ig.ciudad);
  const otras = aprobadas.filter((o) => o.id !== ig.id && mismoTipo(o, ig) && normalizar(o.ciudad) === ciudad);
  if (otras.length === 0) return base;
  const mismoEstado = otras.some((o) => normalizar(o.estado) === normalizar(ig.estado));
  return mismoEstado ? `${base}, ${ig.estado}, ${ig.pais}` : `${base}, ${ig.estado}`;
}

export function detalleIglesia(ig: IglesiaBase): string {
  if (ig.comunidad === "amigos") return "Para quien no pertenece a una iglesia o prefiere no decir";
  const lugar = `${ig.ciudad}, ${ig.estado}, ${ig.pais}`;
  return ig.comunidad === "otra" ? `${ig.denominacion} · ${lugar}` : lugar;
}

/** "la Iglesia de Las Vegas" (LLDM lleva artículo); los demás, tal cual. */
export function enFrase(nombre: string, comunidad: Comunidad, mayuscula = false): string {
  if (comunidad !== "lldm") return nombre;
  return `${mayuscula ? "La" : "la"} ${nombre}`;
}
