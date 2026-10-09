"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { guardarPregunta } from "./acciones";
import { CATEGORIAS, CATEGORIA_LABEL, NIVELES, NIVEL_LABEL } from "@/lib/trivia/banco";

export interface PreguntaEditable {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  bible_reference: string | null;
  dificultad: string | null;
  categoria: string | null;
}

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

const LETRAS = ["a", "b", "c", "d"] as const;

function BotonGuardar({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
      style={{ background: "var(--color-primary)", color: "#000" }}
    >
      {pending && <Loader2 size={15} className="animate-spin" />}
      {editando ? "Guardar cambios" : "Agregar al banco"}
    </button>
  );
}

export function PreguntaFormBanco({
  pregunta,
  filtros,
  onCancelar,
}: {
  pregunta?: PreguntaEditable;
  filtros: string;
  onCancelar?: () => void;
}) {
  const editando = Boolean(pregunta);

  return (
    <form
      action={guardarPregunta}
      className="flex flex-col gap-4 p-5 rounded-2xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        {editando ? "Editar pregunta" : "Agregar pregunta"}
      </h2>

      {pregunta && <input type="hidden" name="id" value={pregunta.id} />}
      <input type="hidden" name="filtros" value={filtros} />

      <label className="flex flex-col gap-1.5 text-xs font-medium" style={{ color: "var(--color-text)" }}>
        Pregunta
        <textarea
          name="question_text"
          required
          rows={2}
          maxLength={400}
          defaultValue={pregunta?.question_text ?? ""}
          placeholder="¿Qué profeta fue echado en el foso de los leones?"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
          style={inputStyle}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium mb-2" style={{ color: "var(--color-text)" }}>
          Opciones (marca la correcta)
        </legend>
        {LETRAS.map((letra) => (
          <div key={letra} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct_option"
              value={letra}
              required
              defaultChecked={pregunta?.correct_option === letra}
              aria-label={`La opción ${letra.toUpperCase()} es la correcta`}
              className="w-4 h-4 shrink-0"
              style={{ accentColor: "var(--color-success)" }}
            />
            <span className="w-5 text-xs font-bold uppercase" style={{ color: "var(--color-primary)" }}>
              {letra}
            </span>
            <input
              type="text"
              name={`option_${letra}`}
              required
              maxLength={200}
              defaultValue={pregunta ? pregunta[`option_${letra}`] : ""}
              className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>
        ))}
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium" style={{ color: "var(--color-text)" }}>
          Cita (Reina-Valera 1960)
          <input
            type="text"
            name="bible_reference"
            required
            maxLength={100}
            defaultValue={pregunta?.bible_reference ?? ""}
            placeholder="Daniel 6:16"
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium" style={{ color: "var(--color-text)" }}>
          Nivel
          <select
            name="dificultad"
            required
            defaultValue={pregunta?.dificultad ?? ""}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          >
            <option value="" disabled>
              Elegir…
            </option>
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {NIVEL_LABEL[n]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium" style={{ color: "var(--color-text)" }}>
          Categoría
          <select
            name="categoria"
            required
            defaultValue={pregunta?.categoria ?? ""}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          >
            <option value="" disabled>
              Elegir…
            </option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2 justify-end">
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
          >
            Cancelar
          </button>
        )}
        <BotonGuardar editando={editando} />
      </div>
    </form>
  );
}
