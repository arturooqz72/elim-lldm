// src/components/admin/PalabraDiariaForm.tsx
import { LIBROS_BIBLIA } from "@/lib/palabra/libros";
import { CATEGORIAS_PALABRA, NOMBRE_CATEGORIA } from "@/lib/palabra/logica";
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
            Ya se jugó o se está jugando: solo puedes corregir la explicación, la referencia y las pistas.
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

      <fieldset className="flex flex-col gap-3 p-3 rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
        <legend className="px-1 text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
          Pistas (obligatorias)
        </legend>

        <div>
          <label className={label} style={{ color: "var(--color-text)" }}>
            Categoría — se ve desde el inicio
          </label>
          <select
            name="categoria"
            required
            defaultValue={editando?.categoria ?? ""}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
          >
            <option value="" disabled>
              Elige una…
            </option>
            {CATEGORIAS_PALABRA.map((c) => (
              <option key={c} value={c}>
                {NOMBRE_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[1fr_88px] gap-2">
          <div>
            <label className={label} style={{ color: "var(--color-text)" }}>
              Libro
            </label>
            <select
              name="libro"
              required
              defaultValue={editando?.libro ?? ""}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            >
              <option value="" disabled>
                Elige…
              </option>
              {LIBROS_BIBLIA.map((l) => (
                <option key={l.nombre} value={l.nombre}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} style={{ color: "var(--color-text)" }}>
              Capítulo
            </label>
            <input
              type="number"
              name="capitulo"
              required
              min={1}
              max={150}
              defaultValue={editando?.capitulo ?? ""}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>
        </div>
        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          Se muestra como &quot;Búscala en Mateo 6&quot; después del 2.º intento fallido. Revisa que la
          palabra aparezca tal cual (no solo en plural) en ese capítulo de la Reina-Valera 1960.
        </p>
      </fieldset>

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
