import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { ElimIaChat } from "@/components/elim-ia/ElimIaChat";
import type { ElimIAMessage, Profile } from "@/types";

export const metadata = { title: "Elim IA — Elim LLDM" };

export default async function ElimIaPage() {
  const profile = (await getProfile()) as Profile | null;
  if (!profile) redirect("/login?returnUrl=/elim-ia");

  const supabase = await createClient();
  const { data } = await supabase
    .from("elim_ia_messages")
    .select("mode, role, content")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(100);

  const messages = (data ?? []) as Pick<ElimIAMessage, "mode" | "role" | "content">[];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-4rem)]">
      <ElimIaChat initialMessages={messages} displayName={profile.display_name} />
    </div>
  );
}
