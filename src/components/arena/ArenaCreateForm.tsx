"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import type { AnswerOption } from "@/types";

interface PreguntaForm {
  pregunta: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  respuesta_correcta: AnswerOption;
}

const SAMPLE_PREGUNTAS: PreguntaForm[] = [
  {
    pregunta: "¿Cuántos libros tiene la Biblia?",
    opcion_a: "66",
    opcion_b: "73",
    opcion_c: "39",
    opcion_d: "27",
    respuesta_correcta: "a",
  },
  {
    pregunta: "¿Quién construyó el arca?",
    opcion_a: "Moisés",
    opcion_b: "Abraham",
    opcion_c: "Noé",
    opcion_d: "David",
    respuesta_correcta: "c",
  },
  {
    pregunta: "¿En qué ciudad nació Jesús?",
    opcion_a: "Nazaret",
    opcion_b: "Belén",
    opcion_c: "Jerusalén",
    opcion_d: "Jericó",
    respuesta_correcta: "b",
  },
  {
    pregunta: "¿Cuántos apóstoles tuvo Jesús?",
    opcion_a: "10",
    opcion_b: "7",
    opcion_c: "12",
    opcion_d: "14",
    respuesta_correcta: "c",
  },
  {
    pregunta: "¿Quién fue tragado por un gran pez?",
    opcion_a: "Elías",
    opcion_b: "Jonás",
    opcion_c: "Daniel",
    opcion_d: "Pablo",
    respuesta_correcta: "b",
  },
];

const EMPTY_PREGUNTA: PreguntaForm = {
  pregunta: "",
  opcion_a: "",
  opcion_b: "",
  opcion_c: "",
  opcion_d: "",
  respuesta_correcta: "a",
};

const MIN_PREGUNTAS = 5;
const MAX_PREGUNTAS = 20;

export function ArenaCreateForm() {
  const [titulo, setTitulo] = useState("Elim Arena");
  const [preguntas, setPreguntas] = useState<PreguntaForm[]>(SAMPLE_PREGUNTAS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function updatePregunta(index: number, field: keyof PreguntaForm, value: string) {
    setPreguntas((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addPregunta() {
    if (preguntas.length >= MAX_PREGUNTAS) return;
    setPreguntas((prev) => [...prev, { ...EMPTY_PREGUNTA }]);
  }

  function removePregunta(index: number) {
    if (preguntas.length <= MIN_PREGUNTAS) return;
    setPreguntas((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const p of preguntas) {
      if (
        !p.pregunta.trim() ||
        !p.opcion_a.trim() ||
        !p.opcion_b.trim() ||
        !p.opcion_c.trim() ||
        !p.opcion_d.trim()
      ) {
        setError("Completa todas las preguntas y opciones antes de continuar.");
        return;
      }
    }

    setSubmitting(true);
    const res = await fetch("/api/arena/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: titulo.trim(), preguntas }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Error al crear la sala");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    router.push(`/arena/${data.codigo}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Título de la sala
        </label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={60}
          className="rounded-xl px-4 py-3 text-base outline-none transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        />
      </div>

      <div className="flex flex-col gap-4">
        {preguntas.map((p, i) => (
          <PreguntaEditor
            key={i}
            index={i}
            pregunta={p}
            onChange={updatePregunta}
            onRemove={() => removePregunta(i)}
            canRemove={preguntas.length > MIN_PREGUNTAS}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addPregunta}
        disabled={preguntas.length >= MAX_PREGUNTAS}
        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px dashed var(--color-border)",
          color: preguntas.length >= MAX_PREGUNTAS ? "var(--color-text-muted)" : "var(--color-primary)",
          cursor: preguntas.length >= MAX_PREGUNTAS ? "not-allowed" : "pointer",
        }}
      >
        <Plus size={16} />
        Agregar pregunta ({preguntas.length}/{MAX_PREGUNTAS})
      </button>

      {error && (
        <p className="text-sm" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl text-base font-bold transition-all duration-200"
        style={{
          background: submitting ? "var(--color-surface-elevated)" : "var(--color-primary)",
          color: submitting ? "var(--color-text-muted)" : "#000",
        }}
      >
        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
        Crear sala
      </button>
    </form>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

const OPTION_KEYS: { key: keyof PreguntaForm; label: string; answer: AnswerOption }[] = [
  { key: "opcion_a", label: "A", answer: "a" },
  { key: "opcion_b", label: "B", answer: "b" },
  { key: "opcion_c", label: "C", answer: "c" },
  { key: "opcion_d", label: "D", answer: "d" },
];

function PreguntaEditor({
  index,
  pregunta,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  pregunta: PreguntaForm;
  onChange: (index: number, field: keyof PreguntaForm, value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
          Pregunta {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--color-destructive)" }}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <input
        type="text"
        value={pregunta.pregunta}
        onChange={(e) => onChange(index, "pregunta", e.target.value)}
        placeholder="Escribe la pregunta..."
        className="rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      />

      <div className="grid grid-cols-1 gap-2">
        {OPTION_KEYS.map(({ key, label, answer }) => {
          const isCorrect = pregunta.respuesta_correcta === answer;
          return (
            <div key={key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange(index, "respuesta_correcta", answer)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
                style={{
                  background: isCorrect ? "var(--color-success)" : "var(--color-surface-elevated)",
                  color: isCorrect ? "#000" : "var(--color-text-muted)",
                  border: `1px solid ${isCorrect ? "var(--color-success)" : "var(--color-border)"}`,
                }}
                title="Marcar como correcta"
              >
                {label}
              </button>
              <input
                type="text"
                value={pregunta[key] as string}
                onChange={(e) => onChange(index, key, e.target.value)}
                placeholder={`Opción ${label}`}
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: "var(--color-surface-elevated)",
                  border: `1px solid ${isCorrect ? "var(--color-success)" : "var(--color-border)"}`,
                  color: "var(--color-text)",
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
