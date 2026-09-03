import { NextResponse } from "next/server";
import { advanceRoomOnce } from "@/lib/arena-publica/advance.server";

export async function POST(request: Request) {
  let body: { sala_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const salaId = body.sala_id;
  if (!salaId) {
    return NextResponse.json({ error: "sala_id es requerido" }, { status: 400 });
  }

  const { applied, error } = await advanceRoomOnce(salaId);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ applied });
}
