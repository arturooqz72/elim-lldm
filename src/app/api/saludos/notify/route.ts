import { NextResponse } from "next/server";
import { sendZohoMail } from "@/lib/mail/zoho";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface NotifyBody {
  nombre?: string;
  contacto?: string;
}

export async function POST(request: Request) {
  let body: NotifyBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim() ?? "";
  const contacto = body.contacto?.trim() ?? "";

  if (!EMAIL_RE.test(contacto)) {
    // No es un correo (puede ser WhatsApp u otro dato) — no hay nada que enviar.
    return NextResponse.json({ skipped: true });
  }

  try {
    await sendZohoMail({
      to: contacto,
      subject: "Gracias por tu saludo — Elim LLDM",
      text:
        `La Paz del Señor, ${nombre || "hermano/a"}:\n\n` +
        "Dios le pague por su saludo de audio. Pronto lo estaremos subiendo a la radio. " +
        "Dios le bendiga.\n\n" +
        "— Elim LLDM",
      html:
        `<p>La Paz del Señor, ${nombre || "hermano/a"}:</p>` +
        "<p>Dios le pague por su saludo de audio. Pronto lo estaremos subiendo a la radio. Dios le bendiga.</p>" +
        "<p>— Elim LLDM</p>",
    });
  } catch (err) {
    console.error("Error enviando correo de agradecimiento de saludo:", err);
    return NextResponse.json({ error: "No se pudo enviar el correo" }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
