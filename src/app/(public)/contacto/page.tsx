import { Mail } from "lucide-react";
import type { Metadata } from "next";
import { ContactForm } from "@/components/contacto/ContactForm";

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
