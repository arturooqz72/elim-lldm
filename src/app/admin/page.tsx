import { createClient } from "@/lib/supabase/server";
import { Users, Mic, Gamepad2, Archive, Radio } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Dashboard — Admin" };

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: platikaLiveCount },
    { count: platikaScheduledCount },
    { count: gameActiveCount },
    { count: archiveCount },
    { data: recentPlatikas },
    { data: recentGames },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("platikas").select("*", { count: "exact", head: true }).eq("status", "live"),
    supabase.from("platikas").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase.from("games").select("*", { count: "exact", head: true }).in("status", ["lobby", "in_progress"]),
    supabase.from("archive").select("*", { count: "exact", head: true }).eq("is_published", true),
    supabase
      .from("platikas")
      .select("id, title, status, scheduled_at")
      .in("status", ["live", "scheduled"])
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase
      .from("games")
      .select("id, title, status, join_code")
      .in("status", ["lobby", "in_progress"])
      .limit(5),
  ]);

  const stats = [
    {
      label: "Usuarios registrados",
      value: userCount ?? 0,
      icon: Users,
      href: "/admin/usuarios",
      color: "#60A5FA",
    },
    {
      label: "Estudio en Vivo activo",
      value: platikaLiveCount ?? 0,
      icon: Radio,
      href: "/admin/platikas",
      color: "var(--color-live)",
      pulse: (platikaLiveCount ?? 0) > 0,
    },
    {
      label: "Estudio en Vivo programado",
      value: platikaScheduledCount ?? 0,
      icon: Mic,
      href: "/admin/platikas",
      color: "var(--color-primary)",
    },
    {
      label: "Juegos activos",
      value: gameActiveCount ?? 0,
      icon: Gamepad2,
      href: "/admin/juegos",
      color: "var(--color-success)",
    },
    {
      label: "Archivos publicados",
      value: archiveCount ?? 0,
      icon: Archive,
      href: "/admin/archivo",
      color: "#A78BFA",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Vista general de la plataforma Elim LLDM
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 hover:opacity-80"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.pulse ? "animate-pulse" : ""}`}
                style={{ background: `${s.color}20` }}
              >
                <Icon size={18} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
                  {s.value}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {s.label}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <QuickAction
          href="/admin/platikas/nueva"
          label="Nueva sesión de Estudio en Vivo"
          description="Programar una transmisión en vivo"
          color="var(--color-primary)"
        />
        <QuickAction
          href="/admin/juegos/nueva"
          label="Nueva partida"
          description="Crear un juego bíblico"
          color="var(--color-success)"
        />
        <QuickAction
          href="/admin/question-sets/nueva"
          label="Nuevo set de preguntas"
          description="Crear banco de preguntas bíblicas"
          color="#60A5FA"
        />
        <QuickAction
          href="/trivia/nueva"
          label="Nueva sala de Trivia"
          description="Abrir una sala de trivia en vivo"
          color="var(--trivia-gold)"
        />
        <QuickAction
          href="/admin/archivo/nueva"
          label="Subir grabación"
          description="Agregar pláticas al archivo"
          color="#A78BFA"
        />
      </div>

      {/* Recent activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent pláticas */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Estudio en Vivo reciente
            </span>
            <Link
              href="/admin/platikas"
              className="text-xs"
              style={{ color: "var(--color-primary)" }}
            >
              Ver todas
            </Link>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {!recentPlatikas || recentPlatikas.length === 0 ? (
              <p className="text-xs py-3 text-center" style={{ color: "var(--color-text-muted)" }}>
                Sin sesiones programadas
              </p>
            ) : (
              (recentPlatikas as Array<{ id: string; title: string; status: string; scheduled_at: string | null }>).map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/platikas/${p.id}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: "var(--color-surface-elevated)" }}
                >
                  <span className="text-sm truncate" style={{ color: "var(--color-text)" }}>
                    {p.title}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium ml-2 shrink-0"
                    style={{
                      background: p.status === "live" ? "rgba(255,68,68,0.15)" : "rgba(212,160,23,0.1)",
                      color: p.status === "live" ? "var(--color-live)" : "var(--color-primary)",
                    }}
                  >
                    {p.status === "live" ? "EN VIVO" : "PROGRAMADA"}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Active games */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Juegos activos
            </span>
            <Link
              href="/admin/juegos"
              className="text-xs"
              style={{ color: "var(--color-primary)" }}
            >
              Ver todos
            </Link>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {!recentGames || recentGames.length === 0 ? (
              <p className="text-xs py-3 text-center" style={{ color: "var(--color-text-muted)" }}>
                Sin juegos activos
              </p>
            ) : (
              (recentGames as Array<{ id: string; title: string; status: string; join_code: string }>).map((g) => (
                <Link
                  key={g.id}
                  href={`/admin/juegos/${g.id}/host`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: "var(--color-surface-elevated)" }}
                >
                  <span className="text-sm truncate" style={{ color: "var(--color-text)" }}>
                    {g.title}
                  </span>
                  <span
                    className="font-mono text-xs font-bold ml-2 shrink-0"
                    style={{ color: "var(--color-primary)" }}
                  >
                    #{g.join_code}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  label,
  description,
  color,
}: {
  href: string;
  label: string;
  description: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 hover:opacity-80"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="w-2 h-10 rounded-full shrink-0"
        style={{ background: color }}
      />
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {label}
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {description}
        </p>
      </div>
    </Link>
  );
}
