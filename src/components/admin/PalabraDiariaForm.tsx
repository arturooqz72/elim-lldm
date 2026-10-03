// src/components/admin/PalabraDiariaForm.tsx
import type { PalabraDiaria } from "@/types";

interface PalabraDiariaFormProps {
  action: (formData: FormData) => Promise<void>;
  editando: PalabraDiaria | null;
  /** Primer día libre desde hoy, para no tener que buscarlo a mano. */
  fechaSugerida: string;
  fechaMinima: string;
  /** Hoy o pasada: la palabra y la fecha ya no se pueden cambiar. */
  bloquearPalabra: boolean;
  cancelarHref: string;
}

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

export function PalabraDiariaForm({
  action,
  editando,
  fechaSugerida,
  fechaMinima,
  bloquearPalabra,
  cancelarHref,
}: PalabraDiariaFormProps) {
  const label = "block text-xs font-medium mb-1.5";

  return (
    <form
      // key: al pasar de "editar X" a "agregar" el formulario se reinicia.
      key={editando?.id ?? "nueva"}
      action={action}
      className="flex flex-col gap-4 p-5 rounded-2xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        {editando ? "Editar palabra" : "Agregar palabra"}
      </h2>

      {editando && <input type="hidden" name="id" value={editando.id} />}

      <div>
        <label className={label} style={{ color: "var(--color-text)" }}>
          Fecha
        </label>
        <input
          type="date"
          name="fecha"
          required
          min={bloquearPalabra ? undefined : fechaMinima}
          readOnly={bloquearPalabra}
          defaultValue={editando?.fecha ?? fechaSugerida}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ ...inputStyle, opacity: bloquearPalabra ? 0.6 : 1 }}
        />
      </div>

      <div>
        <label className={label} style={{ color: "var(--color-text)" }}>
          Palabra (5 letras)
        </label>
        <input
          type="text"
          name="palabra"
          required
          minLength={5}
          maxLength={5}
          pattern="[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{5}"
          title="Exactamente 5 letras; puede llevar acentos y Ñ"
          readOnly={bloquearPalabra}
          defaultValue={editando?.palabra ?? ""}
          placeholder="Ej: SALMO"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none uppercase tracking-widest"
          style={{ ...inputStyle, opacity: bloquearPalabra ? 0.6 : 1 }}
        />
        {bloquearPalabra && (
          <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
            Ya se jugó o se está jugando: solo puedes corregir la explicación y la referencia.
          </p>
        )}
      </div>

      <div>
        <label className={label} style={{ color: "var(--color-text)" }}>
          Explicación (una línea)
        </label>
        <textarea
          name="explicacion"
          required
          rows={2}
          maxLength={200}
          defaultValue={editando?.explicacion ?? ""}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
          style={inputStyle}
        />
      </div>

      <div>
        <label className={label} style={{ color: "var(--color-text)" }}>
          Referencia bíblica (solo la cita)
        </label>
        <input
          type="text"
          name="referencia"
          required
          maxLength={60}
          defaultValue={editando?.referencia ?? ""}
          placeholder="Ej: Juan 3:16"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        />
      </div>

      <div className="flex gap-2 pt-1">
        {editando && (
          <a
            href={cancelarHref}
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
          {editando ? "Guardar cambios" : "Agregar palabra"}
        </button>
      </div>
    </form>
  );
}
