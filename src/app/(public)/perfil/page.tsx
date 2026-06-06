import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile, createClient, createServiceClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/perfil/ProfileForm";
import { formatDate } from "@/lib/utils";
import {
  ShieldCheck,
  Gamepad2,
  Mic,
  Star,
  Calendar,
  Pencil,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi Perfil — Elim LLDM",
};

async function updateProfile(formData: FormData) {
  "use server";
  const display_name = (formData.get("display_name") as string)?.trim();
  const bio = (formData.get("bio") as string)?.trim() ?? "";

  if (!display_name || display_name.length < 2 || display_name.length > 60) {
    redirect("/perfil?error=validation");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnUrl=/perfil");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name, bio: bio || null })
    .eq("id", user.id);

  if (error) redirect("/perfil?error=save");

  revalidatePath("/perfil");
  redirect("/perfil?updated=1");
}

interface Props {
  searchParams: Promise<{ updated?: string; error?: string }>;
}

export default async function PerfilPage({ searchParams }: Props) {
  const { updated, error } = await searchParams;
  const profile = await getProfile();

  if (!profile) redirect("/login?returnUrl=/perfil");

  const p = profile as {
    id: string;
    display_name: string;
    avatar_url: string | null;
    role: string;
    verified_lldm: boolean;
    bio: string | null;
    created_at: string;
  };

  // Stats via service client — game_players / platikas_requests lack public SELECT policies
  const service = await createServiceClient();
  const [{ data: playerRows }, { data: stageRows }] = await Promise.all([
    service.from("game_players").select("id, score").eq("user_id", p.id),
    service
      .from("platikas_requests")
      .select("id")
      .eq("user_id", p.id)
      .in("status", ["approved", "completed"]),
  ]);

  const gamesPlayed = playerRows?.length ?? 0;
  const totalScore =
    (playerRows as Array<{ score: number }> | null)?.reduce(
      (sum, r) => sum + (r.score ?? 0),
      0
    ) ?? 0;
  const stageCount = stageRows?.length ?? 0;

  const ROLE_LABEL: Record<string, string> = {
    admin: "Administrador",
    anfitrion: "Anfitrión",
    participante: "Participante",
  };

  const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
    admin: { bg: "rgba(96,165,250,0.12)", color: "var(--color-info)" },
    anfitrion: { bg: "rgba(212,160,23,0.12)", color: "var(--color-primary)" },
    participante: { bg: "rgba(144,144,168,0.12)", color: "var(--color-text-muted)" },
  };
  const rs = ROLE_STYLE[p.role] ?? ROLE_STYLE.participante;

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>

      {/* ── PROFILE HEADER ───────────────────────────────────────── */}
      <div
        className="py-12 px-4"
        style={{
          background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-2xl mx-auto flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            {p.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={p.display_name}
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: "2px solid var(--color-border)" }}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                style={{
                  background: "rgba(212,160,23,0.1)",
                  border: "2px solid rgba(212,160,23,0.2)",
                  color: "var(--color-primary)",
                }}
              >
                {p.display_name[0]?.toUpperCase()}
              </div>
            )}
            {p.verified_lldm && (
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: "var(--color-primary)" }}
                title="Miembro LLDM verificado"
              >
                <ShieldCheck size={13} color="#000" />
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex flex-col gap-2 min-w-0">
            <h1 className="text-2xl font-bold truncate" style={{ color: "var(--color-text)" }}>
              {p.display_name}
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ background: rs.bg, color: rs.color }}
              >
                {ROLE_LABEL[p.role] ?? p.role}
              </span>
              {p.verified_lldm && (
                <span
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(212,160,23,0.1)",
                    color: "var(--color-primary)",
                    border: "1px solid rgba(212,160,23,0.2)",
                  }}
                >
                  <ShieldCheck size={10} />
                  Verificado LLDM
                </span>
              )}
            </div>

            {p.bio && (
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {p.bio}
              </p>
            )}

            <div
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Calendar size={11} />
              Miembro desde {formatDate(p.created_at).split(",")[0]}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── STATS ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Gamepad2, value: gamesPlayed, label: "Juegos jugados" },
            { icon: Star, value: totalScore.toLocaleString(), label: "Puntuación total" },
            { icon: Mic, value: stageCount, label: "Veces en escenario" },
          ].map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="rounded-2xl p-4 flex flex-col items-center gap-1.5"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <Icon size={16} style={{ color: "var(--color-primary)" }} />
              <span className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
                {value}
              </span>
              <span
                className="text-xs text-center leading-tight"
                style={{ color: "var(--color-text-muted)" }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── EDIT FORM ─────────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            className="flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <Pencil size={14} style={{ color: "var(--color-primary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Editar perfil
            </h2>
          </div>

          {/* Feedback banners */}
          {updated === "1" && (
            <div
              className="mx-5 mt-4 px-4 py-3 rounded-xl flex items-center gap-2 text-sm"
              style={{
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.2)",
                color: "var(--color-success)",
              }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--color-success)" }} />
              Perfil actualizado correctamente.
            </div>
          )}
          {error && (
            <div
              className="mx-5 mt-4 px-4 py-3 rounded-xl flex items-center gap-2 text-sm"
              style={{
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                color: "var(--color-destructive)",
              }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--color-destructive)" }} />
              {error === "validation"
                ? "El nombre debe tener entre 2 y 60 caracteres."
                : "No se pudo guardar. Intenta de nuevo."}
            </div>
          )}

          {/* Client component for live char-count + pending state */}
          <ProfileForm
            defaultDisplayName={p.display_name}
            defaultBio={p.bio ?? ""}
            updateAction={updateProfile}
          />
        </div>

        {/* ── ACCOUNT INFO ─────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-3"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Información de cuenta
          </h2>
          <div
            className="flex flex-col divide-y"
            style={{ borderColor: "var(--color-border)" }}
          >
            {[
              { label: "ID de usuario", value: p.id, mono: true },
              { label: "Rol", value: ROLE_LABEL[p.role] ?? p.role },
              {
                label: "Verificación LLDM",
                value: p.verified_lldm ? "Verificado ✓" : "No verificado",
                success: p.verified_lldm,
              },
              { label: "Miembro desde", value: formatDate(p.created_at) },
            ].map(({ label, value, mono, success }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <span className="text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>
                  {label}
                </span>
                <span
                  className={`text-xs text-right truncate ${mono ? "font-mono" : ""}`}
                  style={{
                    color: success ? "var(--color-success)" : "var(--color-text)",
                    maxWidth: "60%",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {!p.verified_lldm && (
            <p
              className="text-xs px-3 py-2.5 rounded-xl mt-1"
              style={{
                background: "rgba(212,160,23,0.05)",
                border: "1px solid rgba(212,160,23,0.12)",
                color: "var(--color-text-muted)",
              }}
            >
              Para obtener el rol de Anfitrión y la verificación LLDM, contacta
              a un administrador de la plataforma.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
