import { getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { setsConPreguntasActivas } from "@/lib/trivia/sets.server";
import { TikTokTriviaControl } from "@/components/tiktok-trivia/TikTokTriviaControl";

export const metadata: Metadata = { title: "Trivia TikTok — Elim LLDM" };

export default async function TikTokTriviaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/tiktok-trivia");
  if (profile.role !== "admin" && profile.role !== "anfitrion") {
    redirect("/");
  }

  const sets = await setsConPreguntasActivas();

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
          Trivia en vivo por TikTok
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
          Los espectadores responden comentando A, B, C o D directo en tu TikTok Live.
        </p>
        <TikTokTriviaControl questionSets={sets} />
      </div>
    </div>
  );
}
