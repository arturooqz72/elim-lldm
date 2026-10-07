import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { stripeServidor } from "@/lib/ingles/stripe.server";

// Webhook de Stripe para Elim English. Verifica la firma con el cuerpo crudo
// y acredita los mensajes con english_acreditar_compra, que es idempotente:
// si Stripe reintenta el mismo evento (o manda completed y luego
// async_payment_succeeded de la misma sesión), no se acredita dos veces.
export async function POST(request: Request) {
  const stripe = stripeServidor();
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secreto) {
    console.error("Elim English — webhook sin STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "No configurado" }, { status: 500 });
  }

  const firma = request.headers.get("stripe-signature");
  if (!firma) return NextResponse.json({ error: "Falta la firma" }, { status: 400 });

  const cuerpo = await request.text();
  let evento: Stripe.Event;
  try {
    evento = stripe.webhooks.constructEvent(cuerpo, firma, secreto);
  } catch (err) {
    console.warn("Elim English — firma de webhook inválida:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  if (evento.type !== "checkout.session.completed" && evento.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ recibido: true });
  }

  const session = evento.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    // Pago diferido todavía pendiente: llegará async_payment_succeeded.
    return NextResponse.json({ recibido: true });
  }

  const userId = session.metadata?.user_id;
  const paquete = session.metadata?.paquete;
  const mensajes = Number.parseInt(session.metadata?.mensajes ?? "", 10);
  if (!userId || !paquete || !Number.isFinite(mensajes) || mensajes <= 0) {
    // No es una compra de Elim English (u otra integración de la misma cuenta).
    console.warn("Elim English — sesión sin metadata de compra:", session.id);
    return NextResponse.json({ recibido: true });
  }

  const admin = await createServiceClient();
  const { data: acreditado, error } = await admin.rpc("english_acreditar_compra", {
    p_event_id: evento.id,
    p_session_id: session.id,
    p_user: userId,
    p_paquete: paquete,
    p_mensajes: mensajes,
    p_monto_centavos: session.amount_total ?? 0,
    p_moneda: session.currency ?? "usd",
  });

  if (error) {
    // 500 → Stripe reintenta más tarde; la RPC evita el doble abono.
    console.error("Elim English — no se pudo acreditar la compra:", session.id, error.message);
    return NextResponse.json({ error: "No se pudo acreditar" }, { status: 500 });
  }

  return NextResponse.json({ recibido: true, acreditado });
}
