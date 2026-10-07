import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { inglesConfig, inglesPaquetes } from "@/lib/ingles/config";
import { leerSaldo } from "@/lib/ingles/saldo.server";
import { fraseActual, leerProgreso } from "@/lib/ingles/progreso.server";
import { InglesChat } from "@/components/ingles/InglesChat";
import type { InglesMensaje, InglesPerfil, Profile } from "@/types";

export const metadata = { title: "Elim English — Elim LLDM" };

const PERFIL_INICIAL: InglesPerfil = { nivel: "principiante", modo: "conversacion", situacion: "restaurante" };

export default async function InglesPage({ searchParams }: { searchParams: Promise<{ compra?: string }> }) {
  const profile = (await getProfile()) as Profile | null;
  if (!profile) redirect("/login?returnUrl=/ingles");

  const { compra } = await searchParams;
  const supabase = await createClient();

  const { data: perfilData } = await supabase
    .from("english_perfiles")
    .select("nivel, modo, situacion")
    .eq("user_id", profile.id)
    .maybeSingle();
  const perfil = (perfilData as InglesPerfil | null) ?? PERFIL_INICIAL;
  const cfg = inglesConfig();

  const [{ data: mensajesData }, saldo, frase, progreso] = await Promise.all([
    supabase
      .from("english_mensajes")
      .select("modo, role, content")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(200),
    leerSaldo(supabase, profile.id),
    fraseActual(supabase, profile.id, perfil.nivel),
    leerProgreso(supabase, profile.id),
  ]);

  const mensajes = ((mensajesData ?? []) as InglesMensaje[]).reverse();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-4rem)]">
      <InglesChat
        displayName={profile.display_name}
        perfilInicial={perfil}
        mensajesIniciales={mensajes}
        saldoInicial={saldo}
        paquetes={inglesPaquetes()}
        maxCaracteres={cfg.maxCaracteres}
        compra={compra === "ok" ? "ok" : compra === "cancelada" ? "cancelada" : null}
        costoPronunciacion={cfg.costoPronunciacion}
        pronMaxSegundos={cfg.pronMaxSegundos}
        fraseInicial={frase}
        progresoInicial={progreso}
      />
    </div>
  );
}
