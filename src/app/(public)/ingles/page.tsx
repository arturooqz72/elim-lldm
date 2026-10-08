import { cookies } from "next/headers";
import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { inglesConfig, inglesPaquetes, pagosActivos } from "@/lib/ingles/config";
import { leerSaldo } from "@/lib/ingles/saldo.server";
import { fraseActual, leerProgreso } from "@/lib/ingles/progreso.server";
import { anonIdValido, COOKIE_PRUEBA, leerPrueba, reclamarPrueba } from "@/lib/ingles/prueba.server";
import { InglesChat } from "@/components/ingles/InglesChat";
import { InglesPrueba } from "@/components/ingles/InglesPrueba";
import type { InglesMensaje, InglesPerfil, Profile } from "@/types";

export const metadata = { title: "Elim English — Elim LLDM" };

const PERFIL_INICIAL: InglesPerfil = { nivel: "principiante", modo: "conversacion", situacion: "restaurante" };

export default async function InglesPage({ searchParams }: { searchParams: Promise<{ compra?: string }> }) {
  const profile = (await getProfile()) as Profile | null;
  const anonId = anonIdValido((await cookies()).get(COOKIE_PRUEBA)?.value);
  const cfg = inglesConfig();

  // Sin sesión: prueba gratis de unos cuantos mensajes (los cuenta el servidor).
  if (!profile) {
    const prueba = await leerPrueba(await createServiceClient(), anonId);
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-4rem)]">
        <InglesPrueba
          mensajesIniciales={prueba.mensajes}
          restantesIniciales={prueba.restantes}
          totalPrueba={cfg.pruebaMensajes}
          gratisDiarios={cfg.gratisDiarios}
          maxCaracteres={cfg.maxCaracteres}
          reclamadoInicial={prueba.reclamado}
        />
      </div>
    );
  }

  // Con sesión: si este navegador hizo la prueba, su conversación pasa a la
  // cuenta antes de leer el historial (solo la primera vez).
  if (anonId) await reclamarPrueba(await createServiceClient(), anonId, profile.id);

  const { compra } = await searchParams;
  const supabase = await createClient();

  const { data: perfilData } = await supabase
    .from("english_perfiles")
    .select("nivel, modo, situacion")
    .eq("user_id", profile.id)
    .maybeSingle();
  const perfil = (perfilData as InglesPerfil | null) ?? PERFIL_INICIAL;

  const [{ data: mensajesData }, saldo, frase, progreso, { data: espera }] = await Promise.all([
    supabase
      .from("english_mensajes")
      .select("modo, role, content")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(200),
    leerSaldo(supabase, profile.id),
    fraseActual(supabase, profile.id, perfil.nivel),
    leerProgreso(supabase, profile.id),
    supabase.from("english_lista_espera").select("user_id").eq("user_id", profile.id).maybeSingle(),
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
        pagosActivos={pagosActivos()}
        enListaEspera={Boolean(espera)}
      />
    </div>
  );
}
