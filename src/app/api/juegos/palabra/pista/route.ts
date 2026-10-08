// src/app/api/juegos/palabra/pista/route.ts
//
// Ya no se piden pistas: desde 0066_palabra_pistas.sql la categoría se ve
// desde el inicio y "Búscala en Mateo 6" llega sola con la respuesta de
// /api/juegos/palabra/intento después del 2.º intento fallido. Esta ruta
// queda solo para avisar a una página vieja abierta antes del cambio.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "sin_pista_manual",
      mensaje: "Las pistas ahora aparecen solas y son gratis. Recarga la página.",
    },
    { status: 410 }
  );
}
