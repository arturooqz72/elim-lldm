import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { formatDate } from "@/lib/utils";
import { CheckCircle, XCircle, ShieldCheck, User } from "lucide-react";

export const metadata = { title: "Usuarios — Admin" };

async function toggleVerified(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const verified = formData.get("verified") === "true";
  const supabase = await createServiceClient();
  await supabase.from("profiles").update({ verified_lldm: !verified }).eq("id", id);
  revalidatePath("/admin/usuarios");
}

async function setRole(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const role = formData.get("role") as string;
  const supabase = await createServiceClient();
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/usuarios");
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { q, role } = await searchParams;
  const supabase = await createServiceClient();

  let query = supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role, verified_lldm, created_at")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("display_name", `%${q}%`);
  if (role) query = query.eq("role", role);

  const { data: users } = await query;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            Usuarios
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {users?.length ?? 0} usuarios registrados
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-3 mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre..."
          className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        />
        <select
          name="role"
          defaultValue={role ?? ""}
          className="rounded-xl px-4 py-2.5 text-sm outline-none"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <option value="">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="anfitrion">Anfitrión</option>
          <option value="participante">Participante</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          Filtrar
        </button>
      </form>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div
          className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}
        >
          <span>Usuario</span>
          <span>Rol</span>
          <span>Verificado</span>
          <span>Acciones</span>
        </div>

        {(!users || users.length === 0) ? (
          <p className="text-center py-10 text-sm" style={{ color: "var(--color-text-muted)" }}>
            No se encontraron usuarios
          </p>
        ) : (
          (users as Array<{
            id: string;
            display_name: string;
            avatar_url: string | null;
            role: string;
            verified_lldm: boolean;
            created_at: string;
          }>).map((user, idx) => (
            <div
              key={user.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3"
              style={{
                borderBottom: idx < users.length - 1 ? "1px solid var(--color-border)" : "none",
              }}
            >
              {/* User */}
              <div className="flex items-center gap-3 min-w-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.display_name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
                  >
                    {user.display_name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                    {user.display_name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {formatDate(user.created_at).split(",")[0]}
                  </p>
                </div>
              </div>

              {/* Role */}
              <form action={setRole} className="flex items-center gap-1">
                <input type="hidden" name="id" value={user.id} />
                <select
                  name="role"
                  defaultValue={user.role}
                  className="rounded-lg px-2 py-1 text-xs outline-none"
                  style={{
                    background: "var(--color-surface-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <option value="participante">Participante</option>
                  <option value="anfitrion">Anfitrión</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  className="rounded px-1.5 py-1 text-xs font-bold"
                  style={{ background: "var(--color-surface-elevated)", color: "var(--color-primary)", border: "1px solid var(--color-border)" }}
                  title="Aplicar rol"
                >
                  ✓
                </button>
              </form>

              {/* Verified LLDM */}
              <div className="flex justify-center">
                {user.verified_lldm ? (
                  <CheckCircle size={16} style={{ color: "var(--color-success)" }} />
                ) : (
                  <XCircle size={16} style={{ color: "var(--color-text-muted)" }} />
                )}
              </div>

              {/* Actions */}
              <form action={toggleVerified}>
                <input type="hidden" name="id" value={user.id} />
                <input type="hidden" name="verified" value={String(user.verified_lldm)} />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: user.verified_lldm
                      ? "rgba(248,113,113,0.1)"
                      : "rgba(74,222,128,0.1)",
                    color: user.verified_lldm
                      ? "var(--color-destructive)"
                      : "var(--color-success)",
                    border: `1px solid ${user.verified_lldm ? "rgba(248,113,113,0.2)" : "rgba(74,222,128,0.2)"}`,
                  }}
                >
                  {user.verified_lldm ? (
                    <><User size={11} /> Quitar verificación</>
                  ) : (
                    <><ShieldCheck size={11} /> Verificar LLDM</>
                  )}
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
