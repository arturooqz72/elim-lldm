import { Mail, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { ContactForm } from "@/components/contacto/ContactForm";
import { whatsappHref } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contáctanos — Elim LLDM",
  description:
    "Envíanos tus sugerencias, comentarios o peticiones de oración. Nos encantaría escucharte.",
};

export default function ContactoPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{
              background: "rgba(212,160,23,0.1)",
              border: "1px solid rgba(212,160,23,0.2)",
            }}
          >
            <Mail size={24} style={{ color: "var(--color-primary)" }} />
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--color-text)" }}>
            Contáctanos
          </h1>
          <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
            ¿Tienes una sugerencia, pregunta o petición? Escríbenos y te leeremos con gusto.
          </p>
        </div>

        <a
          href={whatsappHref()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 rounded-2xl mb-6 transition-transform duration-200 hover:scale-[1.01]"
          style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.3)" }}
        >
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(37,211,102,0.15)" }}
          >
            <MessageCircle size={20} style={{ color: "#25D366" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Chatea con nosotros por WhatsApp
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Respuesta más directa y rápida — toca para abrir la conversación
            </p>
          </div>
        </a>

        <p
          className="text-center text-xs mb-6 uppercase tracking-wider font-semibold"
          style={{ color: "var(--color-text-muted)" }}
        >
          — o escríbenos aquí —
        </p>

        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
