// src/lib/whatsapp.ts

// Número exclusivo de Elim LLDM para contacto directo por WhatsApp
// (distinto del 7022493957 reservado para mensajes automáticos de
// negocio vía Meta Business — ver project_elim_lldm.md sección "Número
// de WhatsApp dedicado"). Este es solo un enlace wa.me: abre el
// WhatsApp del propio visitante con el número ya puesto, así que no
// depende de ningún trámite de verificación.
export const WHATSAPP_NUMBER = "17252779358";

export function whatsappHref(mensaje?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
