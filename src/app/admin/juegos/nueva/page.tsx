import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { generateJoinCode } from "@/lib/utils";

export const metadata = { title: "Nueva partida — Admin" };

async function createGame(formData: FormData) {
  "use server";
  const profile = await getProfile();
  if (!profile) return;

  const title = (formData.get("title") as string).trim();
  const question_set_id = formData.get("question_set_id") as string;

  // Parse teams
  const teamNames = formData.getAll("team_name") as string[];
  const teamColors = formData.getAll("team_color") as string[];
  const teams = teamNames
    .map((name, i) => ({ name: name.trim(), color: teamColors[i] ?? "#D4A017" }))
    .filter((t) => t.name);

  if (teams.length < 2) return;

  const supabase = await createServiceClient();

  const { data: game, error } = await supabase
    .from("games")
    .insert({
      title,
      host_id: profile.id,
      question_set_id,
      status: "lobby",
      join_code: generateJoinCode(),
    })
    .select("id")
    .single();

  if (error || !game) return;

  const gameId = (game as { id: string }).id;

  // Insert teams
  await supabase.from("game_teams").insert(
    teams.map((t) => ({ game_id: gameId, name: t.name, color: t.color }))
  );

  redirect(`/admin/juegos/${gameId}/host`);
}

export default async function NuevaPartidaPage() {
  const supabase = await createClient();

  const { data: questionSets } = await supabase
    .from("question_sets")
    .select("id, title, questions(count)")
    .eq("is_public", true)
    .order("title");

  const TEAM_COLORS = ["#D4A017", "#60A5FA", "#4ADE80", "#F87171"];
  const DEFAULT_TEAM_NAMES = ["Equipo Oro", "Equipo Azul", "Equipo Verde", "Equipo Rojo"];

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/juegos"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={15} />
          Juegos
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text)" }}>
        Nueva partida
      </h1>

      <form action={createGame} className="flex flex-col gap-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Título de la partida <span style={{ color: "var(--color-live)" }}>*</span>
          </label>
          <input
            type="text"
            name="title"
            required
            maxLength={100}
            placeholder="Ej: Torneo de Profecías — Junio 2026"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        {/* Question set */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Set de preguntas <span style={{ color: "var(--color-live)" }}>*</span>
          </label>
          {!questionSets || questionSets.length === 0 ? (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                color: "var(--color-destructive)",
              }}
            >
              No hay sets de preguntas.{" "}
              <Link href="/admin/question-sets/nueva" style={{ textDecoration: "underline" }}>
                Crea uno primero.
              </Link>
            </div>
          ) : (
            <select
              name="question_set_id"
              required
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <option value="">Seleccionar set...</option>
              {(questionSets as unknown as Array<{
                id: string;
                title: string;
                questions: unknown[];
              }>).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Teams */}
        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: "var(--color-text)" }}>
            Equipos (mínimo 2)
          </label>
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="color"
                  name="team_color"
                  defaultValue={TEAM_COLORS[i]}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  name="team_name"
                  defaultValue={i < 2 ? DEFAULT_TEAM_NAMES[i] : ""}
                  maxLength={30}
                  placeholder={`Nombre del equipo ${i + 1}${i < 2 ? " (requerido)" : " (opcional)"}`}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{
                    background: "var(--color-surface-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
            Deja vacíos los equipos que no necesites
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/admin/juegos"
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-center"
            style={{
              background: "var(--color-surface-elevated)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            Crear y abrir sala
          </button>
        </div>
      </form>
    </div>
  );
}
