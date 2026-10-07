// src/lib/ingles/stripe.server.ts
// Cliente de Stripe para Elim English. Solo servidor: usa STRIPE_SECRET_KEY.

import Stripe from "stripe";

let cliente: Stripe | null = null;

/** null si Stripe no está configurado (falta STRIPE_SECRET_KEY). */
export function stripeServidor(): Stripe | null {
  const clave = process.env.STRIPE_SECRET_KEY;
  if (!clave) return null;
  cliente ??= new Stripe(clave);
  return cliente;
}
