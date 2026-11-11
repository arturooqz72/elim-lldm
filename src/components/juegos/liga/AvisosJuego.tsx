// src/components/juegos/liga/AvisosJuego.tsx
// En los juegos, /juegos y /juegos/liga, con el perfil que ya carga cada
// página: primero la regla general; ya aceptada, la pregunta de la iglesia
// (esta última solo en los juegos y la Liga, y nunca a admins).
import { aceptoVersionActual } from "@/lib/reglas";
import { PantallaReglas } from "@/components/reglas/PantallaReglas";
import { AvisoIglesia } from "./AvisoIglesia";

export interface PerfilAvisos {
  role?: string | null;
  display_name?: string | null;
  iglesia_id?: string | null;
  iglesia_preguntada?: boolean | null;
  acepto_reglas_version?: string | null;
}

export function AvisosJuego({ perfil, preguntarIglesia = true }: { perfil: PerfilAvisos | null; preguntarIglesia?: boolean }) {
  if (!perfil) return null;
  if (!aceptoVersionActual(perfil.acepto_reglas_version)) return <PantallaReglas nombreInicial={perfil.display_name ?? ""} />;
  if (!preguntarIglesia || perfil.role === "admin" || perfil.iglesia_id || perfil.iglesia_preguntada) return null;
  return <AvisoIglesia />;
}
