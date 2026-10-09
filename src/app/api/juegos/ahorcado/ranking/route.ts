// src/app/api/juegos/ahorcado/ranking/route.ts
import { NextResponse } from "next/server";

// Ya no se usa: aceptaba el puntaje que mandara el navegador. Ahora el
// servidor suma los puntos y guarda el récord al ganar cada palabra (ver
// adivinarLetra en ahorcado.server.ts).
export async function POST() {
  return NextResponse.json(
    { error: "Esta ruta ya no existe. Recarga la página para seguir jugando." },
    { status: 410 }
  );
}
