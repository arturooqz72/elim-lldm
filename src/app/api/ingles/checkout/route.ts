import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarPaquete, pagosActivos } from "@/lib/ingles/config";
import { ETIQUETA_PAQUETE } from "@/lib/ingles/etiquetas";
import { stripeServidor } from "@/lib/ingles/stripe.server";

// Crea una sesión de Stripe Checkout (pago único). El navegador solo manda
// el id del paquete; mensajes y precio salen de la configuración del servidor.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Venta pausada (ENGLISH_PAYMENTS_ENABLED != "true"): no se crea ningún cobro.
  if (!pagosActivos()) {
    return NextResponse.json({ error: "Por ahora no hay compras disponibles" }, { status: 403 });
  }

  const stripe = stripeServidor();
  if (!stripe) return NextResponse.json({ error: "Los pagos no están configurados" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as { paquete?: string } | null;
  const paquete = buscarPaquete(body?.paquete);
  if (!paquete) return NextResponse.json({ error: "Paquete no válido" }, { status: 400 });

  const origen = new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: paquete.moneda,
            unit_amount: paquete.precioCentavos,
            product_data: {
              name: `Elim English — ${ETIQUETA_PAQUETE[paquete.id]}`,
              description: `${paquete.mensajes} mensajes con la tutora de inglés`,
            },
          },
        },
      ],
      metadata: {
        user_id: user.id,
        paquete: paquete.id,
        mensajes: String(paquete.mensajes),
      },
      success_url: `${origen}/ingles?compra=ok`,
      cancel_url: `${origen}/ingles?compra=cancelada`,
    });

    if (!session.url) throw new Error("Stripe no devolvió la URL de pago");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Elim English — error al crear el checkout:", err);
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 502 });
  }
}
