import { Pencil, Save, Trash2 } from "lucide-react";

export interface CategoriaVideo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order_index: number;
}

interface CategoriaFilaProps {
  categoria: CategoriaVideo;
  videos: number;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

const etiqueta = "block text-xs font-medium mb-1";

/** Una categoría con "Editar" y "Eliminar" desplegables (sin ventanas emergentes). */
export function CategoriaFila({ categoria: cat, videos, updateAction, deleteAction }: CategoriaFilaProps) {
  return (
    <div
      className="flex flex-col gap-2 px-4 py-3 rounded-xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {cat.icon && (
            <span className="text-sm" style={{ color: "var(--color-primary)" }}>
              {cat.icon}
            </span>
          )}
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {cat.name}
          </p>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          /{cat.slug} · {videos} {videos === 1 ? "video" : "videos"}
          {cat.description ? ` · ${cat.description}` : ""}
        </p>
      </div>

      <details>
        <summary
          className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer list-none min-h-8"
          style={{ color: "var(--color-primary)" }}
        >
          <Pencil size={12} /> Editar
        </summary>
        <form action={updateAction} className="flex flex-col gap-3 mt-2">
          <input type="hidden" name="id" value={cat.id} />
          <div>
            <label className={etiqueta} style={{ color: "var(--color-text)" }}>
              Nombre
            </label>
            <input
              type="text"
              name="name"
              required
              maxLength={60}
              defaultValue={cat.name}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className={etiqueta} style={{ color: "var(--color-text)" }}>
              Descripción
            </label>
            <input
              type="text"
              name="description"
              maxLength={120}
              defaultValue={cat.description ?? ""}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiqueta} style={{ color: "var(--color-text)" }}>
                Ícono (emoji)
              </label>
              <input
                type="text"
                name="icon"
                maxLength={4}
                defaultValue={cat.icon ?? ""}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className={etiqueta} style={{ color: "var(--color-text)" }}>
                Orden
              </label>
              <input
                type="number"
                name="order_index"
                min={0}
                defaultValue={cat.order_index}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            El enlace /{cat.slug} no cambia, para que no se rompan los enlaces ya compartidos.
          </p>
          <button
            type="submit"
            className="self-start flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Save size={12} /> Guardar cambios
          </button>
        </form>
      </details>

      <details>
        <summary
          className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer list-none min-h-8"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Trash2 size={12} /> Eliminar
        </summary>
        <form action={deleteAction} className="flex flex-col gap-2 mt-2">
          <input type="hidden" name="id" value={cat.id} />
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {videos > 0
              ? `Sus ${videos} ${videos === 1 ? "video pasa" : "videos pasan"} a "Sin categoría"; los videos no se borran.`
              : "No tiene videos."}
          </p>
          <button
            type="submit"
            className="self-start px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "var(--color-destructive)", color: "#000" }}
          >
            Sí, eliminar categoría
          </button>
        </form>
      </details>
    </div>
  );
}
