// src/lib/archivo/mantenimiento.ts
// Modo mantenimiento del Archivo público (/archivo). Con
// ARCHIVO_MAINTENANCE="true" la página muestra un aviso en lugar del listado
// y las grabaciones sueltas redirigen al aviso. Cualquier otro valor (o sin
// definir) = normal. El panel admin (/admin/archivo) sigue funcionando para
// ir subiendo grabaciones. Solo servidor.

export function archivoEnMantenimiento(): boolean {
  return process.env.ARCHIVO_MAINTENANCE === "true";
}
