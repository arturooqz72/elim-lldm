"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

const BIO_MAX = 160;
const NAME_MAX = 60;

interface ProfileFormProps {
  defaultDisplayName: string;
  defaultBio: string;
  updateAction: (formData: FormData) => Promise<void>;
}

export function ProfileForm({
  defaultDisplayName,
  defaultBio,
  updateAction,
}: ProfileFormProps) {
  const [name, setName] = useState(defaultDisplayName);
  const [bio, setBio] = useState(defaultBio);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      updateAction(formData);
    });
  }

  const nameOk = name.trim().length >= 2 && name.trim().length <= NAME_MAX;
  const bioOk = bio.length <= BIO_MAX;
  const canSave = nameOk && bioOk && !isPending;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">

      {/* Display name */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="display_name"
            className="text-xs font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            Nombre público
          </label>
          <span
            className="text-xs font-mono"
            style={{
              color:
                name.trim().length > NAME_MAX
                  ? "var(--color-destructive)"
                  : "var(--color-text-muted)",
            }}
          >
            {name.trim().length}/{NAME_MAX}
          </span>
        </div>
        <input
          id="display_name"
          name="display_name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={NAME_MAX}
          placeholder="Tu nombre en la plataforma"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: `1px solid ${!nameOk && name.length > 0 ? "var(--color-destructive)" : "var(--color-border)"}`,
            color: "var(--color-text)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-primary)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor =
              !nameOk && name.length > 0
                ? "var(--color-destructive)"
                : "var(--color-border)";
          }}
        />
        {!nameOk && name.length > 0 && name.trim().length < 2 && (
          <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
            El nombre debe tener al menos 2 caracteres.
          </p>
        )}
      </div>

      {/* Bio */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="bio"
            className="text-xs font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            Biografía{" "}
            <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>
              (opcional)
            </span>
          </label>
          <span
            className="text-xs font-mono"
            style={{
              color:
                bio.length > BIO_MAX
                  ? "var(--color-destructive)"
                  : bio.length > BIO_MAX * 0.85
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)",
            }}
          >
            {bio.length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={BIO_MAX}
          rows={3}
          placeholder="Cuéntale algo a la comunidad sobre ti…"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-primary)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
          }}
        />
      </div>

      {/* Save button */}
      <button
        type="submit"
        disabled={!canSave}
        className="self-end flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
        style={{
          background: canSave ? "var(--color-primary)" : "var(--color-surface-elevated)",
          color: canSave ? "#000" : "var(--color-text-muted)",
          cursor: canSave ? "pointer" : "not-allowed",
        }}
        onMouseEnter={(e) => {
          if (canSave)
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 20px rgba(212,160,23,0.4)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {isPending && <Loader2 size={14} className="animate-spin" />}
        {isPending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
