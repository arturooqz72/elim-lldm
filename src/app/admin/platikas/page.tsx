import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Plus, Mic, Radio } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Pláticas — Admin" };

export default async function AdminPlatikaListPage() {
  const supabase = await createClient();

  const { data: platikas } = await supabase
    .from("platikas")
    .select("id, title, status, scheduled_at, started_at, ended_at, radio_output_active, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const byStatus = {
    live: (platikas ?? []).filter((p: { status: string }) => p.status === "live"),
    scheduled: (platikas ?? []).filter((p: { status: string }) => p.status === "scheduled"),
    ended: (platikas ?? []).filter((p: { status: string }) => p.status === "ended"),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            Pláticas
          </h1>
        </div>
        <Link
          href="/admin/platikas/nueva"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          <Plus size={16} />
          Nueva plática
        </Link>
      </div>

      {(["live", "scheduled", "ended"] as const).map((status) => {
        const items = byStatus[status];
        if (items.length === 0) return null;
        return (
          <section key={status} className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
              {status === "live" ? "En vivo" : status === "scheduled" ? "Programadas" : "Terminadas"}
              <span className="ml-2 font-normal normal-case">({items.length})</span>
            </h2>
            <div className="flex flex-col gap-2">
              {(items as unknown as Array<{
                id: string;
                title: string;
                status: string;
                scheduled_at: string | null;
                started_at: string | null;
                ended_at: string | null;
                radio_output_active: boolean;
                profiles: { display_name: string } | null;
              }>).map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/platikas/${p.id}`}
                  className="flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-200 hover:opacity-80"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Mic size={15} style={{ color: "var(--color-primary)" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                        {p.title}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {(p.profiles as { display_name: string } | null)?.display_name ?? "Sin anfitrión"} ·{" "}
                        {p.scheduled_at ? formatDate(p.scheduled_at) : p.started_at ? formatDate(p.started_at) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.radio_output_active && (
                      <Radio size={13} style={{ color: "var(--color-primary)" }} />
                    )}
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background:
                          p.status === "live"
                            ? "rgba(255,68,68,0.15)"
                            : p.status === "scheduled"
                            ? "rgba(212,160,23,0.1)"
                            : "var(--color-surface-elevated)",
                        color:
                          p.status === "live"
                            ? "var(--color-live)"
                            : p.status === "scheduled"
                            ? "var(--color-primary)"
                            : "var(--color-text-muted)",
                      }}
                    >
                      {p.status === "live" ? "EN VIVO" : p.status === "scheduled" ? "PROGRAMADA" : "TERMINADA"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {(!platikas || platikas.length === 0) && (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Mic size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>No hay pláticas. Crea la primera.</p>
        </div>
      )}
    </div>
  );
}
