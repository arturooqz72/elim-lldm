"use client";

export function DeleteForm({
  action,
  id,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("¿Eliminar esta plática permanentemente?")) {
      e.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="px-4 py-2 rounded-xl text-xs font-semibold"
        style={{
          background: "rgba(248,113,113,0.15)",
          color: "var(--color-destructive)",
          border: "1px solid rgba(248,113,113,0.3)",
        }}
      >
        Eliminar plática
      </button>
    </form>
  );
}
