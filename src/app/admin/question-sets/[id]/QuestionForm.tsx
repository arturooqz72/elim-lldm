"use client";

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  bible_reference: string | null;
  time_limit_seconds: number;
  points: number;
  order_index: number;
};

interface Props {
  setId: string;
  nextOrderIndex: number;
  editQuestion?: Question;
  addAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
}

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

const OPTIONS = ["a", "b", "c", "d"] as const;

export function QuestionForm({
  setId,
  nextOrderIndex,
  editQuestion,
  addAction,
  updateAction,
}: Props) {
  const isEdit = !!editQuestion;
  const action = isEdit ? updateAction : addAction;

  return (
    <form
      action={action}
      className="flex flex-col gap-4 p-5 rounded-2xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <h2
        className="text-sm font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {isEdit ? "Editar pregunta" : "Agregar pregunta"}
      </h2>

      {isEdit && <input type="hidden" name="questionId" value={editQuestion.id} />}
      <input type="hidden" name="setId" value={setId} />
      {!isEdit && <input type="hidden" name="order_index" value={nextOrderIndex} />}

      {/* Question text */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Pregunta <span style={{ color: "var(--color-live)" }}>*</span>
        </label>
        <textarea
          name="question_text"
          required
          rows={3}
          maxLength={400}
          defaultValue={editQuestion?.question_text ?? ""}
          placeholder="¿En qué libro aparece la historia de Jonás?"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
          style={inputStyle}
        />
      </div>

      {/* Options A-D */}
      <div className="flex flex-col gap-2">
        <label className="block text-xs font-medium" style={{ color: "var(--color-text)" }}>
          Opciones <span style={{ color: "var(--color-live)" }}>*</span>
        </label>
        {OPTIONS.map((opt) => {
          const key = `option_${opt}` as keyof Question;
          return (
            <div key={opt} className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 uppercase"
                style={{ background: "rgba(212,160,23,0.1)", color: "var(--color-primary)" }}
              >
                {opt}
              </span>
              <input
                type="text"
                name={`option_${opt}`}
                required
                maxLength={200}
                defaultValue={(editQuestion?.[key] as string) ?? ""}
                placeholder={`Opción ${opt.toUpperCase()}`}
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
            </div>
          );
        })}
      </div>

      {/* Correct option */}
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-text)" }}>
          Respuesta correcta <span style={{ color: "var(--color-live)" }}>*</span>
        </label>
        <div className="flex gap-4">
          {OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="correct_option"
                value={opt}
                required
                defaultChecked={editQuestion?.correct_option === opt}
                className="accent-yellow-500"
              />
              <span className="text-sm font-bold uppercase" style={{ color: "var(--color-primary)" }}>
                {opt}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Bible reference */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Referencia bíblica
        </label>
        <input
          type="text"
          name="bible_reference"
          maxLength={60}
          defaultValue={editQuestion?.bible_reference ?? ""}
          placeholder="Ej: Jonás 1:17"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        />
      </div>

      {/* Time + points */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Tiempo (seg)
          </label>
          <input
            type="number"
            name="time_limit_seconds"
            min={5}
            max={120}
            defaultValue={editQuestion?.time_limit_seconds ?? 30}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Puntos
          </label>
          <input
            type="number"
            name="points"
            min={10}
            max={1000}
            step={10}
            defaultValue={editQuestion?.points ?? 100}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {isEdit && (
          <a
            href={`/admin/question-sets/${setId}`}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            Cancelar
          </a>
        )}
        <button
          type="submit"
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          {isEdit ? "Guardar cambios" : "Agregar pregunta"}
        </button>
      </div>
    </form>
  );
}
