"use client";

import { useTransition } from "react";

interface RoleSelectProps {
  defaultValue: string;
}

/**
 * Select de rol que aplica el cambio solo con elegir la opción — sin un
 * botón "Aplicar" aparte que se puede pasar por alto. El bug real que
 * motivó esto (2026-09-09): un admin cambió el valor del menú a "Admin"
 * pero nunca hizo clic en el botón ✓ de al lado (chiquito, sin texto), así
 * que el cambio nunca se mandó — la base de datos y el server action
 * estaban bien todo este tiempo, era pura fricción de UI.
 *
 * Sigue viviendo dentro del <form action={setRole}> del server component
 * padre — este componente solo dispara el submit de ese form al detectar
 * el cambio, vía requestSubmit() (dispara el Server Action real, no un
 * submit nativo de recarga de página).
 */
export function RoleSelect({ defaultValue }: RoleSelectProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      name="role"
      defaultValue={defaultValue}
      disabled={isPending}
      onChange={(e) => {
        const form = e.currentTarget.form;
        startTransition(() => {
          form?.requestSubmit();
        });
      }}
      className="rounded-lg px-2 py-1 text-xs outline-none"
      style={{
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text)",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <option value="participante">Participante</option>
      <option value="anfitrion">Anfitrión</option>
      <option value="moderador">Moderador</option>
      <option value="admin">Admin</option>
    </select>
  );
}
