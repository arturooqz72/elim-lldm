import { NextResponse } from "next/server";

// Ya no se usa: mandaba la palabra completa al navegador. El juego ahora
// pide la palabra a /api/juegos/ahorcado/palabra (ver ahorcado.server.ts).
export async function GET() {
  return NextResponse.json(
    { error: "Esta ruta ya no existe. Recarga la página para seguir jugando." },
    { status: 410 }
  );
}
