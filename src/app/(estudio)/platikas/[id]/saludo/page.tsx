import { AudioLines, Radio } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { SaludoRecorder } from "@/components/saludo/SaludoRecorder";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("platikas").select("title").eq("id", id).single();

  return {
    title: data?.title ? `Deja tu saludo — ${data.title}` : "Deja tu saludo — Elim LLDM",
    description: "Graba un saludo en audio desde tu navegador para que lo escuchemos al aire ahora mismo.",
  };
}

export default async function SaludoEnVivoPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: platika } = await supabase
    .from("platikas")
    .select("id, title, status")
    .eq("id", id)
    .single();

  if (!platika) notFound();

  const isActive = platika.status === "backstage" || platika.status === "live";

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
            <AudioLines size={24} style={{ color: "var(--color-primary)" }} />
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--color-text)" }}>
            Deja tu saludo
          </h1>
          <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
            Graba un saludo en audio (hasta 60 segundos) para{" "}
            <span style={{ color: "var(--color-primary)" }}>{platika.title}</span> — podría
            escucharse al aire en unos momentos.
          </p>
        </div>

        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          {isActive ? (
            <SaludoRecorder platikaId={id} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Radio size={28} style={{ color: "var(--color-text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Esta transmisión ya no está en vivo, así que no se pueden dejar más saludos
                aquí. Puedes dejar tu saludo general en{" "}
                <a href="/saludo" style={{ color: "var(--color-primary)" }}>
                  /saludo
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
