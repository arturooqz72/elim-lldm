import type { StageLayout } from "@/types";

// Plantillas nativas de composite egress de LiveKit — no hay una
// plantilla "lado a lado" propia, así que se mapea a "grid" (con 2
// participantes se ve prácticamente igual).
export const EGRESS_TEMPLATE_BY_LAYOUT: Record<StageLayout, string> = {
  solo: "single-speaker",
  lado_a_lado: "grid",
  grid: "grid",
  pantalla: "speaker",
};
