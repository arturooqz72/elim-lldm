"use client";

import { useTransition } from "react";

interface AhorcadoActivoToggleProps {
  defaultChecked: boolean;
}

/**
 * Checkbox de "activo" que aplica el cambio solo con marcar/desmarcar —
 * mismo patrón (y misma lección aprendida) que RoleSelect.tsx en
 * /admin/usuarios: nunca un botón "Guardar" aparte que se puede pasar por
 * alto. Cuando el checkbox no está marcado, el navegador simplemente no
 * manda el campo "activo" en el FormData — el server action (Task 10,
 * Step 2) trata esa ausencia como `false`.
 */
export function AhorcadoActivoToggle({ defaultChecked }: AhorcadoActivoToggleProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      name="activo"
      value="true"
      defaultChecked={defaultChecked}
      disabled={isPending}
      onChange={(e) => {
        const form = e.currentTarget.form;
        startTransition(() => {
          form?.requestSubmit();
        });
      }}
      className="w-4 h-4 accent-yellow-500 shrink-0"
    />
  );
}
