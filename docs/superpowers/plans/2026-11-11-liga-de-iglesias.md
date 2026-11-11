# Liga de Iglesias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir una Liga semanal donde los puntos de Palabra del Día, Trivia en línea, La Ruleta en línea y Ahorcado suman para el equipo de cada jugador:
- "Iglesia de [Ciudad]" para la Iglesia La Luz del Mundo;
- "[Denominación] · [Ciudad]" para otras iglesias;
- "Amigos de Elim" para quien no pertenece a ninguna o prefiere no decir.

Además, la regla general de participación ("Acepto") reemplaza la casilla de permiso en los juegos.

**Architecture:**
- **Registro de puntos:** un registro central `liga_puntos` que solo escribe el servidor con la función SQL `liga_registrar_puntos`, que aplica los topes y bloquea por jugador. Cada juego la llama con `after()` desde el punto donde ya valida el resultado, así un fallo de la Liga nunca rompe el juego.
- **Aceptación de la regla:** se guarda en `profiles.acepto_reglas_en` y `acepto_reglas_version`. Las rutas que empiezan una partida la revisan con `aceptoReglas()`.
- **Pantallas de aviso:** una sola pieza de servidor (`AvisosJuego`) decide qué mostrar: primero la regla y después "¿De qué iglesia eres?".

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase (Postgres, RLS, triggers, service role), Vercel Cron, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-11-11-liga-de-iglesias-design.md` (incluye §8, la regla general, y la Liga abierta a todas las iglesias).

**Verificación en este repo:** no hay test runner. Cada tarea termina con `npx tsc --noEmit`, que debe salir sin errores. Al final van `npm run build` y una prueba en el navegador (Task 17).

**Reglas del usuario:**
- Nunca usar `rm`: los archivos que quedan sin uso se dejan.
- `.env.example` nunca se versiona.
- Preguntar antes de aplicar SQL en producción y antes de subir a master.
- En la interfaz nunca se dice "congregación"; "Iglesia de [Ciudad]" solo para LLDM.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0086_liga_iglesias.sql` | Tablas, columnas de Liga y reglas, trigger de protección, `handle_new_user`, funciones, equipos iniciales |
| `src/lib/reglas.ts` | Texto y versión de la regla (cliente y servidor) |
| `src/lib/reglas.server.ts` | `aceptoReglas()` y respuesta 403 común |
| `src/lib/liga/config.ts` | Reglas de puntos, denominaciones, constantes |
| `src/lib/liga/nombre.ts` | Normalizar, clave, nombre que se muestra, `enFrase` |
| `src/lib/liga/registrar.server.ts` | `registrarPuntosLiga()` |
| `src/lib/liga/consultas.server.ts` | Tabla, mi equipo, jugadores, campeonas, tarjeta, resumen admin |
| `src/app/api/cuenta/reglas/route.ts` | Aceptar la regla y guardar el nombre para mostrar |
| `src/app/api/liga/{iglesias,mi-iglesia,no-preguntar,tabla}/route.ts` | API de la Liga |
| `src/app/api/cron/liga-cierre/route.ts` | Cierre semanal |
| `src/components/reglas/PantallaReglas.tsx` | Pantalla "Acepto" y barra "Para jugar, acepta las reglas" |
| `src/components/juegos/liga/AvisosJuego.tsx` | Decide en el servidor: reglas, luego iglesia |
| `src/components/juegos/liga/SelectorIglesia.tsx` | Pregunta LLDM, denominación, ciudad, agregar |
| `src/components/juegos/liga/AvisoIglesia.tsx` | Modal "En Elim LLDM todos son bienvenidos…" |
| `src/components/juegos/liga/{InvitarHermanos,TablaLiga,TarjetaLigaHub,InvitacionLiga,CambiarIglesia}.tsx` | Piezas de la Liga |
| `src/app/(public)/juegos/liga/page.tsx` | Página de la Liga |
| `src/app/(public)/reglas/page.tsx` | Reglas de los juegos y la Liga |
| `src/app/admin/liga/{page.tsx,acciones.ts}` | Resumen, equipos pendientes y aprobados, tarjeta |
| `src/components/admin/liga/TarjetaLiga.tsx` | Imagen 1080x1920 |

---

### Task 1: Migración 0086

**Files:**
- Create: `supabase/migrations/0086_liga_iglesias.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- ============================================================
-- Elim LLDM — Liga de Iglesias (/juegos/liga) y regla general de
-- participación. Diseño:
-- docs/superpowers/specs/2026-11-11-liga-de-iglesias-design.md
--
-- 1. iglesias: los equipos de la Liga. comunidad = 'lldm' ("Iglesia de
--    [Ciudad]"), 'otra' ("[Denominación] · [Ciudad]") o 'amigos' (una
--    sola fila: "Amigos de Elim"). Lectura pública solo de aprobadas;
--    todo cambio, desde el servidor (service role).
-- 2. profiles: iglesia_id, iglesia_cambiada_en, iglesia_preguntada,
--    acepto_reglas_en y acepto_reglas_version. No entran al GRANT de
--    SELECT por columnas (0076) y un trigger impide cambiarlas desde el
--    navegador (mismo patrón que 0069).
-- 3. liga_puntos: sin permisos para anon/authenticated; solo la escribe
--    liga_registrar_puntos (topes por partida y por día) desde el servidor.
-- 4. liga_campeonas: una fila por semana cerrada (cron del lunes).
-- 5. handle_new_user guarda el nombre para mostrar y la aceptación de la
--    regla que vienen del registro con correo.
--
-- profiles.iglesia (texto libre de 0054) y profiles.tiktok_permiso
-- (0078) se dejan sin borrar; ya no se usan.
-- ============================================================

-- ---------- iglesias ----------
CREATE TABLE iglesias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comunidad TEXT NOT NULL CHECK (comunidad IN ('lldm', 'otra', 'amigos')),
  denominacion TEXT,
  ciudad TEXT CHECK (ciudad IS NULL OR char_length(btrim(ciudad)) BETWEEN 1 AND 60),
  estado TEXT CHECK (estado IS NULL OR char_length(btrim(estado)) BETWEEN 1 AND 60),
  pais TEXT CHECK (pais IS NULL OR char_length(btrim(pais)) BETWEEN 1 AND 60),
  -- comunidad|denominacion|ciudad|estado|pais normalizados (src/lib/liga/nombre.ts).
  clave TEXT NOT NULL UNIQUE,
  aprobada BOOLEAN NOT NULL DEFAULT FALSE,
  creada_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iglesias_forma CHECK (
    (comunidad = 'amigos' AND denominacion IS NULL AND ciudad IS NULL AND estado IS NULL AND pais IS NULL)
    OR (comunidad = 'lldm' AND denominacion IS NULL AND ciudad IS NOT NULL AND estado IS NOT NULL AND pais IS NOT NULL)
    OR (comunidad = 'otra'
        AND denominacion IN ('Católica', 'Bautista', 'Pentecostal', 'Adventista', 'Evangélica', 'Otra cristiana', 'Otra religión')
        AND ciudad IS NOT NULL AND estado IS NOT NULL AND pais IS NOT NULL)
  )
);

CREATE UNIQUE INDEX iglesias_un_solo_amigos ON iglesias (comunidad) WHERE comunidad = 'amigos';
CREATE INDEX idx_iglesias_pendientes ON iglesias (creada_en) WHERE NOT aprobada;

ALTER TABLE iglesias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iglesias_select_aprobadas" ON iglesias FOR SELECT USING (aprobada);
REVOKE ALL ON iglesias FROM anon, authenticated;
GRANT SELECT ON iglesias TO anon, authenticated;


-- ---------- profiles ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS iglesia_id UUID REFERENCES iglesias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS iglesia_cambiada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS iglesia_preguntada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acepto_reglas_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acepto_reglas_version TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_iglesia_id ON profiles (iglesia_id) WHERE iglesia_id IS NOT NULL;

CREATE OR REPLACE FUNCTION profiles_proteger_liga()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.iglesia_id IS DISTINCT FROM OLD.iglesia_id
      OR NEW.iglesia_cambiada_en IS DISTINCT FROM OLD.iglesia_cambiada_en
      OR NEW.iglesia_preguntada IS DISTINCT FROM OLD.iglesia_preguntada
      OR NEW.acepto_reglas_en IS DISTINCT FROM OLD.acepto_reglas_en
      OR NEW.acepto_reglas_version IS DISTINCT FROM OLD.acepto_reglas_version)
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin')
  THEN
    RAISE EXCEPTION 'Esto solo se cambia desde el sitio'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_proteger_liga_trg ON profiles;
CREATE TRIGGER profiles_proteger_liga_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_proteger_liga();


-- ---------- handle_new_user: nombre para mostrar y regla aceptada ----------
-- El registro con correo manda en los metadatos display_name y
-- acepto_reglas_version (solo si marcó "Acepto"). Google y otros
-- proveedores no los mandan: esas cuentas aceptan la regla la primera vez
-- que entran a un juego.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_nombre TEXT := LEFT(btrim(COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    'Usuario'
  )), 60);
  v_version TEXT := NULLIF(btrim(NEW.raw_user_meta_data->>'acepto_reglas_version'), '');
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url, acepto_reglas_en, acepto_reglas_version)
  VALUES (
    NEW.id,
    v_nombre,
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN v_version IS NOT NULL THEN NOW() END,
    v_version
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ---------- liga_puntos ----------
CREATE TABLE liga_puntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jugador UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  iglesia_id UUID REFERENCES iglesias(id) ON DELETE SET NULL,
  juego TEXT NOT NULL CHECK (juego IN ('palabra', 'trivia', 'ruleta', 'ahorcado')),
  puntos INT NOT NULL CHECK (puntos > 0),
  partida_ref TEXT NOT NULL,
  evento_ref TEXT NOT NULL,
  semana DATE NOT NULL,
  dia DATE NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (jugador, juego, evento_ref)
);

CREATE INDEX idx_liga_puntos_semana_iglesia ON liga_puntos (semana, iglesia_id);
CREATE INDEX idx_liga_puntos_jugador_dia ON liga_puntos (jugador, juego, dia);
CREATE INDEX idx_liga_puntos_jugador_partida ON liga_puntos (jugador, juego, partida_ref);

ALTER TABLE liga_puntos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON liga_puntos FROM anon, authenticated;


-- ---------- liga_campeonas ----------
CREATE TABLE liga_campeonas (
  semana DATE PRIMARY KEY,
  iglesia_id UUID REFERENCES iglesias(id) ON DELETE SET NULL,
  puntos INT NOT NULL,
  jugadores INT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE liga_campeonas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liga_campeonas_select" ON liga_campeonas FOR SELECT USING (TRUE);
REVOKE ALL ON liga_campeonas FROM anon, authenticated;
GRANT SELECT ON liga_campeonas TO anon, authenticated;


-- ---------- funciones (solo service role) ----------
CREATE OR REPLACE FUNCTION liga_semana_actual()
RETURNS DATE
LANGUAGE sql STABLE
AS $$
  SELECT date_trunc('week', (now() AT TIME ZONE 'America/Los_Angeles')::date)::date;
$$;

CREATE OR REPLACE FUNCTION liga_registrar_puntos(
  p_jugador UUID,
  p_juego TEXT,
  p_puntos INT,
  p_partida TEXT,
  p_evento TEXT,
  p_max_partida INT,
  p_tope_dia INT
)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dia DATE := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  v_semana DATE := date_trunc('week', (now() AT TIME ZONE 'America/Los_Angeles')::date)::date;
  v_iglesia UUID;
  v_rol TEXT;
  v_usado INT;
  v_margen INT;
  v_filas INT;
BEGIN
  IF p_puntos IS NULL OR p_puntos <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('liga:' || p_jugador::text));

  SELECT iglesia_id, role INTO v_iglesia, v_rol FROM profiles WHERE id = p_jugador;
  IF NOT FOUND OR v_rol = 'admin' THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(puntos), 0) INTO v_usado
  FROM liga_puntos WHERE jugador = p_jugador AND juego = p_juego AND dia = v_dia;
  v_margen := LEAST(p_puntos, p_tope_dia - v_usado);

  IF p_max_partida IS NOT NULL THEN
    SELECT COALESCE(SUM(puntos), 0) INTO v_usado
    FROM liga_puntos WHERE jugador = p_jugador AND juego = p_juego AND partida_ref = p_partida;
    v_margen := LEAST(v_margen, p_max_partida - v_usado);
  END IF;

  IF v_margen <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO liga_puntos (jugador, iglesia_id, juego, puntos, partida_ref, evento_ref, semana, dia)
  VALUES (p_jugador, v_iglesia, p_juego, v_margen, p_partida, p_evento, v_semana, v_dia)
  ON CONFLICT (jugador, juego, evento_ref) DO NOTHING;
  GET DIAGNOSTICS v_filas = ROW_COUNT;

  RETURN CASE WHEN v_filas > 0 THEN v_margen ELSE 0 END;
END;
$$;

-- Equipos aprobados con puntos en una semana. Empate: más jugadores y
-- luego quien llegó primero a ese total.
CREATE OR REPLACE FUNCTION liga_tabla_semana(p_semana DATE)
RETURNS TABLE (iglesia_id UUID, puntos INT, jugadores INT, ultimo TIMESTAMPTZ)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT lp.iglesia_id, SUM(lp.puntos)::INT, COUNT(DISTINCT lp.jugador)::INT, MAX(lp.creado_en)
  FROM liga_puntos lp
  JOIN iglesias i ON i.id = lp.iglesia_id AND i.aprobada
  WHERE lp.semana = p_semana
  GROUP BY lp.iglesia_id
  ORDER BY 2 DESC, 3 DESC, 4 ASC;
$$;

CREATE OR REPLACE FUNCTION liga_jugadores_semana(p_semana DATE, p_iglesia UUID, p_limite INT)
RETURNS TABLE (jugador UUID, puntos INT, ultimo TIMESTAMPTZ)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT lp.jugador, SUM(lp.puntos)::INT, MAX(lp.creado_en)
  FROM liga_puntos lp
  WHERE lp.semana = p_semana
    AND (p_iglesia IS NULL OR lp.iglesia_id = p_iglesia)
  GROUP BY lp.jugador
  ORDER BY 2 DESC, 3 ASC
  LIMIT LEAST(GREATEST(p_limite, 1), 50);
$$;

CREATE OR REPLACE FUNCTION liga_cerrar_semana(p_semana DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_filas INT;
BEGIN
  INSERT INTO liga_campeonas (semana, iglesia_id, puntos, jugadores)
  SELECT p_semana, t.iglesia_id, t.puntos, t.jugadores
  FROM liga_tabla_semana(p_semana) t
  LIMIT 1
  ON CONFLICT (semana) DO NOTHING;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN v_filas > 0;
END;
$$;

CREATE OR REPLACE FUNCTION liga_asignar_sin_iglesia(p_jugador UUID, p_iglesia UUID)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE liga_puntos SET iglesia_id = p_iglesia
  WHERE jugador = p_jugador AND iglesia_id IS NULL AND semana = liga_semana_actual();
$$;

CREATE OR REPLACE FUNCTION liga_juntar_iglesias(p_conservar UUID, p_quitar UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_conservar = p_quitar THEN
    RAISE EXCEPTION 'Elige dos equipos distintos';
  END IF;
  IF EXISTS (SELECT 1 FROM iglesias WHERE id IN (p_conservar, p_quitar) AND comunidad = 'amigos') THEN
    RAISE EXCEPTION 'Amigos de Elim no se junta con otro equipo';
  END IF;
  UPDATE liga_puntos SET iglesia_id = p_conservar WHERE iglesia_id = p_quitar;
  UPDATE liga_campeonas SET iglesia_id = p_conservar WHERE iglesia_id = p_quitar;
  UPDATE profiles SET iglesia_id = p_conservar WHERE iglesia_id = p_quitar;
  DELETE FROM iglesias WHERE id = p_quitar;
END;
$$;

REVOKE ALL ON FUNCTION liga_semana_actual() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_registrar_puntos(UUID, TEXT, INT, TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_tabla_semana(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_jugadores_semana(DATE, UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_cerrar_semana(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_asignar_sin_iglesia(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_juntar_iglesias(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION liga_semana_actual() TO service_role;
GRANT EXECUTE ON FUNCTION liga_registrar_puntos(UUID, TEXT, INT, TEXT, TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION liga_tabla_semana(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION liga_jugadores_semana(DATE, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION liga_cerrar_semana(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION liga_asignar_sin_iglesia(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION liga_juntar_iglesias(UUID, UUID) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON iglesias, liga_puntos, liga_campeonas TO service_role;


-- ---------- equipos iniciales ----------
INSERT INTO iglesias (comunidad, clave, aprobada) VALUES ('amigos', 'amigos', TRUE)
ON CONFLICT (clave) DO NOTHING;

-- Los 4 textos libres de Palabra del Día que sí son ciudades (LLDM).
INSERT INTO iglesias (comunidad, ciudad, estado, pais, clave, aprobada) VALUES
  ('lldm', 'Riverside', 'California', 'Estados Unidos', 'lldm||riverside|california|estados unidos', TRUE),
  ('lldm', 'Guadalajara', 'Jalisco', 'México', 'lldm||guadalajara|jalisco|mexico', TRUE),
  ('lldm', 'Santa Lucía', 'Campeche', 'México', 'lldm||santa lucia|campeche|mexico', TRUE),
  ('lldm', 'Ciudad de México', 'CDMX', 'México', 'lldm||ciudad de mexico|cdmx|mexico', TRUE)
ON CONFLICT (clave) DO NOTHING;

UPDATE profiles p
SET iglesia_id = i.id, iglesia_preguntada = TRUE
FROM iglesias i
WHERE (btrim(p.iglesia) = 'Riverside' AND i.clave = 'lldm||riverside|california|estados unidos')
   OR (btrim(p.iglesia) = 'Guadalajara' AND i.clave = 'lldm||guadalajara|jalisco|mexico')
   OR (btrim(p.iglesia) = 'Santa Lucia, Campeche' AND i.clave = 'lldm||santa lucia|campeche|mexico')
   OR (btrim(p.iglesia) = 'Cdmx, Magdalena' AND i.clave = 'lldm||ciudad de mexico|cdmx|mexico');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0086_liga_iglesias.sql
git commit -m "Liga de Iglesias y regla de participación: migración 0086"
```

(Se aplica en Supabase en la Task 17, con autorización del usuario.)

---

### Task 2: Bibliotecas de reglas y de la Liga

**Files:**
- Create: `src/lib/reglas.ts`, `src/lib/reglas.server.ts`, `src/lib/liga/config.ts`, `src/lib/liga/nombre.ts`, `src/lib/liga/registrar.server.ts`

- [ ] **Step 1: `src/lib/reglas.ts`**

```ts
// src/lib/reglas.ts
//
// Regla general de participación. Si cambia el texto, se sube la versión y
// a todos se les vuelve a pedir "Acepto" una vez.
export const REGLAS_VERSION = "2026-11-11";

export const TEXTO_REGLA_PARTICIPACION =
  "Al participar en los juegos de Elim LLDM aceptas que tu nombre para mostrar y tu foto de perfil puedan aparecer en la Liga, en las tablas de resultados y en los videos de Elim LLDM en redes sociales.";

export const NOTA_NOMBRE_PARA_MOSTRAR = "Este es el nombre que verán los demás y que puede salir en los videos";

export const TEXTO_PARA_TODOS =
  "Elim LLDM es para todos. No importa tu iglesia o denominación, todos son bienvenidos a jugar y participar.";

export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 60;

export function aceptoVersionActual(version: string | null | undefined): boolean {
  return version === REGLAS_VERSION;
}
```

- [ ] **Step 2: `src/lib/reglas.server.ts`**

```ts
// src/lib/reglas.server.ts
import "server-only";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { aceptoVersionActual } from "./reglas";

/** Si el usuario ya aceptó la versión actual de la regla. */
export async function aceptoReglas(userId: string): Promise<boolean> {
  const service = await createServiceClient();
  const { data } = await service.from("profiles").select("acepto_reglas_version").eq("id", userId).maybeSingle();
  return aceptoVersionActual((data?.acepto_reglas_version as string | null | undefined) ?? null);
}

/** Respuesta común cuando falta aceptar la regla. */
export function faltaAceptarReglas() {
  return NextResponse.json({ error: "Acepta las reglas de los juegos para jugar", codigo: "reglas" }, { status: 403 });
}
```

- [ ] **Step 3: `src/lib/liga/config.ts`**

```ts
// src/lib/liga/config.ts
//
// Reglas de puntos de la Liga. Cambiar aquí cambia la Liga y la página
// /reglas; la base solo aplica los topes que se le pasan desde aquí.
import { PALABRA_MAX_INTENTOS } from "@/lib/palabra/config";

export type JuegoLiga = "palabra" | "trivia" | "ruleta" | "ahorcado";

export const LIGA_PUNTOS = {
  palabraBase: 10,
  palabraPorIntentoSobrante: 2,
  triviaPorCorrecta: 1,
  ruletaPorLetra: 1,
  ruletaPorResolver: 5,
  ahorcadoPorPalabra: 2,
} as const;

/** Máximo por partida; null = sin máximo por partida (solo el tope diario). */
export const LIGA_MAX_POR_PARTIDA: Record<JuegoLiga, number | null> = {
  palabra: null,
  trivia: 20,
  ruleta: 20,
  ahorcado: null,
};

export const LIGA_TOPE_DIARIO = 40;
export const LIGA_DIAS_CAMBIO = 30;
export const LIGA_REFRESCO_MS = 30_000;
export const LIGA_URL = "https://www.elimlldm.net/juegos/liga";

/** Debe coincidir con el CHECK iglesias_forma de 0086. */
export const DENOMINACIONES = [
  "Católica",
  "Bautista",
  "Pentecostal",
  "Adventista",
  "Evangélica",
  "Otra cristiana",
  "Otra religión",
] as const;
export type Denominacion = (typeof DENOMINACIONES)[number];

export function esDenominacion(valor: unknown): valor is Denominacion {
  return typeof valor === "string" && (DENOMINACIONES as readonly string[]).includes(valor);
}

export function puntosPalabraLiga(numIntentos: number): number {
  const sobrantes = Math.max(0, PALABRA_MAX_INTENTOS - numIntentos);
  return LIGA_PUNTOS.palabraBase + LIGA_PUNTOS.palabraPorIntentoSobrante * sobrantes;
}

/** `equipoEnFrase` ya viene con artículo si es LLDM ("la Iglesia de Las Vegas"). */
export function textoInvitacion(equipoEnFrase: string | null): string {
  return equipoEnFrase
    ? `Ayuda a ${equipoEnFrase} a ganar la Liga de Elim LLDM 🏆 juega aquí: ${LIGA_URL}`
    : `Juega en la Liga de Iglesias de Elim LLDM 🏆 y suma puntos para tu equipo: ${LIGA_URL}`;
}
```

- [ ] **Step 4: `src/lib/liga/nombre.ts`**

```ts
// src/lib/liga/nombre.ts
//
// Nombre de cada equipo de la Liga:
// - lldm   → "Iglesia de [Ciudad]" (SOLO para la Iglesia La Luz del Mundo)
// - otra   → "[Denominación] · [Ciudad]"
// - amigos → "Amigos de Elim"
// Si otro equipo aprobado del mismo tipo tiene la misma ciudad, se agrega
// el estado; si también coincide el estado, el país. Nunca "congregación".

export type Comunidad = "lldm" | "otra" | "amigos";

export interface IglesiaBase {
  id: string;
  comunidad: Comunidad;
  denominacion: string | null;
  ciudad: string | null;
  estado: string | null;
  pais: string | null;
}

export const COLUMNAS_IGLESIA = "id, comunidad, denominacion, ciudad, estado, pais";
export const NOMBRE_AMIGOS = "Amigos de Elim";

export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function limpiar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** Debe dar lo mismo que las claves escritas a mano en 0086. */
export function claveIglesia(
  comunidad: Exclude<Comunidad, "amigos">,
  denominacion: string | null,
  ciudad: string,
  estado: string,
  pais: string
): string {
  return [comunidad, normalizar(denominacion), normalizar(ciudad), normalizar(estado), normalizar(pais)].join("|");
}

function mismoTipo(a: IglesiaBase, b: IglesiaBase): boolean {
  return a.comunidad === b.comunidad && normalizar(a.denominacion) === normalizar(b.denominacion);
}

/** `aprobadas` = todos los equipos aprobados (para detectar ciudades repetidas). */
export function nombreIglesia(ig: IglesiaBase, aprobadas: IglesiaBase[]): string {
  if (ig.comunidad === "amigos") return NOMBRE_AMIGOS;
  const base = ig.comunidad === "lldm" ? `Iglesia de ${ig.ciudad}` : `${ig.denominacion} · ${ig.ciudad}`;
  const ciudad = normalizar(ig.ciudad);
  const otras = aprobadas.filter((o) => o.id !== ig.id && mismoTipo(o, ig) && normalizar(o.ciudad) === ciudad);
  if (otras.length === 0) return base;
  const mismoEstado = otras.some((o) => normalizar(o.estado) === normalizar(ig.estado));
  return mismoEstado ? `${base}, ${ig.estado}, ${ig.pais}` : `${base}, ${ig.estado}`;
}

export function detalleIglesia(ig: IglesiaBase): string {
  if (ig.comunidad === "amigos") return "Para quien no pertenece a una iglesia o prefiere no decir";
  const lugar = `${ig.ciudad}, ${ig.estado}, ${ig.pais}`;
  return ig.comunidad === "otra" ? `${ig.denominacion} · ${lugar}` : lugar;
}

/** "la Iglesia de Las Vegas" (LLDM lleva artículo); los demás, tal cual. */
export function enFrase(nombre: string, comunidad: Comunidad, mayuscula = false): string {
  if (comunidad !== "lldm") return nombre;
  return `${mayuscula ? "La" : "la"} ${nombre}`;
}
```

- [ ] **Step 5: `src/lib/liga/registrar.server.ts`**

```ts
// src/lib/liga/registrar.server.ts
//
// Único punto por donde entran puntos a la Liga. Lo llaman las rutas de
// cada juego DESPUÉS de validar el resultado en el servidor, con after()
// para no retrasar la respuesta. Nunca lanza.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { LIGA_MAX_POR_PARTIDA, LIGA_TOPE_DIARIO, type JuegoLiga } from "./config";

export interface PuntosLiga {
  jugador: string | null | undefined;
  juego: JuegoLiga;
  puntos: number;
  partidaRef: string;
  eventoRef: string;
}

export async function registrarPuntosLiga(p: PuntosLiga): Promise<number> {
  if (!p.jugador || !(p.puntos > 0)) return 0;
  try {
    const service = await createServiceClient();
    const { data, error } = await service.rpc("liga_registrar_puntos", {
      p_jugador: p.jugador,
      p_juego: p.juego,
      p_puntos: Math.floor(p.puntos),
      p_partida: p.partidaRef,
      p_evento: p.eventoRef,
      p_max_partida: LIGA_MAX_POR_PARTIDA[p.juego],
      p_tope_dia: LIGA_TOPE_DIARIO,
    });
    if (error) {
      console.error("[liga] No se pudieron registrar puntos:", error.message);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (e) {
    console.error("[liga] Error al registrar puntos:", e);
    return 0;
  }
}
```

- [ ] **Step 6: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/lib/reglas.ts src/lib/reglas.server.ts src/lib/liga
git commit -m "Reglas de participación y bibliotecas de la Liga"
```

---

### Task 3: Aceptar la regla (API y revisión en las rutas de juego)

**Files:**
- Create: `src/app/api/cuenta/reglas/route.ts`
- Modify: `src/app/api/juegos/palabra/intento/route.ts`, `src/app/api/arena-publica/join/route.ts`, `src/app/api/ruleta/join/route.ts`, `src/app/api/juegos/ahorcado/palabra/route.ts`

- [ ] **Step 1: API para aceptar**

```ts
// src/app/api/cuenta/reglas/route.ts
//
// Guarda "Acepto" de la regla general (fecha y versión) y el nombre para
// mostrar que eligió en la misma pantalla.
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NOMBRE_MAX, NOMBRE_MIN, REGLAS_VERSION } from "@/lib/reglas";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });

  let body: { version?: unknown; display_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  if (body.version !== REGLAS_VERSION) {
    return NextResponse.json({ error: "Las reglas cambiaron. Recarga la página." }, { status: 409 });
  }
  const nombre = typeof body.display_name === "string" ? body.display_name.replace(/\s+/g, " ").trim() : "";
  if (nombre.length < NOMBRE_MIN || nombre.length > NOMBRE_MAX) {
    return NextResponse.json({ error: `Tu nombre para mostrar debe tener de ${NOMBRE_MIN} a ${NOMBRE_MAX} letras` }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ display_name: nombre, acepto_reglas_en: new Date().toISOString(), acepto_reglas_version: REGLAS_VERSION })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Revisar en las rutas que empiezan o juegan una partida.** En cada una, importar `import { aceptoReglas, faltaAceptarReglas } from "@/lib/reglas.server";` y poner la revisión justo después de confirmar que hay `user`:

`palabra/intento/route.ts`, después de `if (!user) return error(401, "sin_sesion", "Inicia sesión para jugar.");`:

```ts
  if (!(await aceptoReglas(user.id))) return faltaAceptarReglas();
```

`arena-publica/join/route.ts` y `ruleta/join/route.ts`, después del bloque `if (!user) { return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 }); }`:

```ts
  if (!(await aceptoReglas(user.id))) return faltaAceptarReglas();
```

`juegos/ahorcado/palabra/route.ts`, después de `if (!user) return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 });`:

```ts
  if (!(await aceptoReglas(user.id))) return faltaAceptarReglas();
```

(`/api/juegos/ahorcado/palabra-aleatoria` ya responde 410 y no se toca.)

- [ ] **Step 3: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/app/api/cuenta/reglas src/app/api/juegos/palabra/intento/route.ts src/app/api/arena-publica/join/route.ts src/app/api/ruleta/join/route.ts src/app/api/juegos/ahorcado/palabra/route.ts
git commit -m "Regla de participación: aceptar y exigirla para empezar a jugar"
```

---

### Task 4: Pantalla "Acepto", registro con correo y nombre para mostrar

**Files:**
- Create: `src/components/reglas/PantallaReglas.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/components/perfil/ProfileForm.tsx`

- [ ] **Step 1: `PantallaReglas.tsx`**

```tsx
// src/components/reglas/PantallaReglas.tsx
//
// Para quien tiene sesión y todavía no acepta la regla: una pantalla con
// la regla, su nombre para mostrar y "Acepto". Si dice "Ahora no", puede
// ver la página pero queda una barra abajo para aceptar (el servidor no
// le deja empezar partidas). Se cierra por sesión del navegador para no
// abrirse en cada página.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScrollText } from "lucide-react";
import { NOMBRE_MAX, NOMBRE_MIN, NOTA_NOMBRE_PARA_MOSTRAR, REGLAS_VERSION, TEXTO_PARA_TODOS, TEXTO_REGLA_PARTICIPACION } from "@/lib/reglas";

const CLAVE = "elim-reglas-ahora-no";

export function PantallaReglas({ nombreInicial }: { nombreInicial: string }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [nombre, setNombre] = useState(nombreInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cerrada = false;
    try {
      cerrada = sessionStorage.getItem(CLAVE) === REGLAS_VERSION;
    } catch {
      cerrada = false;
    }
    setAbierta(!cerrada);
  }, []);

  function ahoraNo() {
    try {
      sessionStorage.setItem(CLAVE, REGLAS_VERSION);
    } catch {
      // Sin almacenamiento: se vuelve a mostrar en la siguiente página.
    }
    setAbierta(false);
  }

  async function aceptar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/cuenta/reglas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: REGLAS_VERSION, display_name: nombre }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setGuardando(false);
    }
  }

  const largo = nombre.trim().length;
  const nombreOk = largo >= NOMBRE_MIN && largo <= NOMBRE_MAX;

  if (!abierta) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-40 p-3" style={{ background: "rgba(10,10,18,0.95)", borderTop: "1px solid rgba(212,160,23,0.4)" }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <p className="flex-1 text-sm" style={{ color: "var(--color-text)" }}>Para jugar, acepta las reglas de los juegos.</p>
          <button type="button" onClick={() => setAbierta(true)} className="px-4 py-2.5 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
            Ver reglas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} role="dialog" aria-modal="true" aria-labelledby="reglas-titulo">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--color-surface)", border: "1px solid rgba(212,160,23,0.4)" }}>
        <div className="flex items-center gap-2">
          <ScrollText size={20} style={{ color: "var(--color-primary)" }} />
          <h2 id="reglas-titulo" className="text-lg font-bold" style={{ color: "var(--color-text)" }}>Reglas de los juegos</h2>
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{TEXTO_PARA_TODOS}</p>
        <p className="text-sm p-3 rounded-xl" style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}>{TEXTO_REGLA_PARTICIPACION}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Nombre para mostrar</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={NOMBRE_MAX}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{NOTA_NOMBRE_PARA_MOSTRAR}. Puede ser tu nombre o un apodo, por ejemplo &quot;Hermano Juan GDL&quot;.</span>
        </label>
        {error && <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{error}</p>}
        <button type="button" disabled={!nombreOk || guardando} onClick={() => void aceptar()} className="py-3 rounded-xl text-sm font-bold min-h-11 disabled:opacity-60" style={{ background: "var(--color-primary)", color: "#000" }}>
          {guardando ? "Guardando…" : "Acepto"}
        </button>
        <div className="flex items-center justify-between text-sm">
          <Link href="/reglas" className="underline min-h-11 inline-flex items-center" style={{ color: "var(--color-primary)" }}>Ver todas las reglas</Link>
          <button type="button" onClick={ahoraNo} className="underline min-h-11" style={{ color: "var(--color-text-muted)" }}>Ahora no, solo quiero ver</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registro con correo (`login/page.tsx`).**
  - Agregar el import `import { NOMBRE_MAX, NOMBRE_MIN, NOTA_NOMBRE_PARA_MOSTRAR, REGLAS_VERSION, TEXTO_REGLA_PARTICIPACION } from "@/lib/reglas";` y `Link` de `next/link` si no está.
  - Agregar los estados `const [nombreMostrar, setNombreMostrar] = useState("");` y `const [aceptoReglas, setAceptoReglas] = useState(false);` (sin marcar).
  - En `handleEmailSubmit`, dentro del `if (mode === "register" && …)` de validaciones, agregar antes del `setLoading(true)`:

```ts
    if (mode === "register") {
      const n = nombreMostrar.replace(/\s+/g, " ").trim();
      if (n.length < NOMBRE_MIN || n.length > NOMBRE_MAX) {
        setMessage({ type: "error", text: `Tu nombre para mostrar debe tener de ${NOMBRE_MIN} a ${NOMBRE_MAX} letras.` });
        return;
      }
      if (!aceptoReglas) {
        setMessage({ type: "error", text: "Para crear tu cuenta, marca \"Acepto\" en la regla de los juegos." });
        return;
      }
    }
```

  - En `signUp`, cambiar `data: { full_name: cleanEmail.split("@")[0] }` por:

```ts
            data: {
              full_name: nombreMostrar.replace(/\s+/g, " ").trim(),
              display_name: nombreMostrar.replace(/\s+/g, " ").trim(),
              acepto_reglas_version: REGLAS_VERSION,
            },
```

  - Justo debajo del input "Confirmar contraseña" (dentro del mismo `mode === "register"`), agregar:

```tsx
            {mode === "register" && (
              <>
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    placeholder="Nombre para mostrar"
                    value={nombreMostrar}
                    onChange={(e) => setNombreMostrar(e.target.value)}
                    required
                    minLength={NOMBRE_MIN}
                    maxLength={NOMBRE_MAX}
                    autoComplete="nickname"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                    style={inputStyle}
                  />
                  <span className="text-xs px-1" style={{ color: "var(--color-text-muted)" }}>{NOTA_NOMBRE_PARA_MOSTRAR}</span>
                </div>
                <label className="flex items-start gap-3 p-3 rounded-xl text-sm cursor-pointer" style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                  <input type="checkbox" checked={aceptoReglas} onChange={(e) => setAceptoReglas(e.target.checked)} className="mt-1 w-4 h-4 accent-[#D4A017]" />
                  <span>
                    <strong>Acepto.</strong> {TEXTO_REGLA_PARTICIPACION}{" "}
                    <Link href="/reglas" target="_blank" className="underline" style={{ color: "var(--color-primary)" }}>Ver reglas</Link>
                  </span>
                </label>
              </>
            )}
```

  - En `setMode`/`limpiar` (la función que ya borra `password` y `confirmPassword` al cambiar de modo), también poner `setNombreMostrar("")` y `setAceptoReglas(false)`.

- [ ] **Step 3: Nombre para mostrar en /perfil (`ProfileForm.tsx`).**
  - El texto del `<label htmlFor="display_name">` pasa de "Nombre público" a "Nombre para mostrar".
  - Debajo del `<input id="display_name" …/>` (antes del error de validación, si hay), agregar:

```tsx
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {NOTA_NOMBRE_PARA_MOSTRAR}. Puede ser tu nombre o un apodo, por ejemplo &quot;Hermano Juan GDL&quot;.
        </p>
```

  - Importar `NOTA_NOMBRE_PARA_MOSTRAR` de `@/lib/reglas`.

- [ ] **Step 4: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/components/reglas "src/app/(auth)/login/page.tsx" src/components/perfil/ProfileForm.tsx
git commit -m "Regla de participación: pantalla Acepto, registro y nombre para mostrar"
```

---

### Task 5: Quitar la casilla de permiso y usar la regla en tarjetas y videos

**Files:**
- Modify: `src/app/(public)/juegos/page.tsx`, `src/components/juegos/PuertaArenaAbierta.tsx`, `src/components/juegos/PuertaRuleta.tsx`, `src/components/arena-publica/ArenaPublicaRoom.tsx`, `src/components/juegos/ahorcado/AhorcadoGame.tsx`, `src/components/ruleta/MatchEndScreen.tsx`, `src/app/(public)/juegos/palabra/page.tsx`, `src/app/(public)/perfil/page.tsx`, `src/lib/juegos/campeones.server.ts`, `src/lib/palabra/puntos.server.ts`

- [ ] **Step 1: /juegos.** En `juegos/page.tsx`:
  - quitar el import de `PermisoVideosProvider, CasillaPermisoJuego`;
  - quitar las líneas `const perfil = …`, `const modoPermiso = …` y su comentario;
  - cambiar `<PermisoVideosProvider …>` y su cierre por un fragmento `<>`…`</>`;
  - borrar las dos líneas `<CasillaPermisoJuego />`.

- [ ] **Step 2: Puertas.** En `PuertaArenaAbierta.tsx` y `PuertaRuleta.tsx`, quitar el import de `CasillaPermisoJuego` y la línea `<CasillaPermisoJuego />`.

- [ ] **Step 3: Pregunta al terminar.** En `ArenaPublicaRoom.tsx`, `AhorcadoGame.tsx` y `MatchEndScreen.tsx`, quitar el import de `PreguntaTikTokJuego` y su uso (`<PreguntaTikTokJuego />` y `{juegoTerminado && <PreguntaTikTokJuego />}`).

- [ ] **Step 4: Palabra del Día.** En `juegos/palabra/page.tsx`, cambiar la prop `tiktok={{ … }}` por `tiktok={null}` y quitar los imports `debePreguntarTikTok` y `nombreCorto` si quedan sin uso. `PalabraResultado` ya maneja `tiktok === null` y no muestra ni la pregunta ni la casilla.

- [ ] **Step 5: /perfil.** Quitar el bloque `{/* ── TIKTOK ── */}` completo (el `<div>` con "Videos de TikTok, Instagram y YouTube") y el import de `PermisoTikTok`.

- [ ] **Step 6: Campeones de la semana (`campeones.server.ts`).**
  - En la interfaz `Perfil`, cambiar `tiktok_permiso: boolean | null;` por `acepto_reglas_en: string | null;`.
  - En `perfiles()`, el select pasa a `"id, display_name, avatar_url, role, acepto_reglas_en"`.
  - `persona()` pasa a ser:

```ts
function persona(p: Perfil | undefined): { nombre: string; avatar: string | null; conPermiso: boolean } {
  // Regla general (§8 del diseño): quien aceptó sale con su nombre para
  // mostrar y su foto; quien nunca aceptó, como "Hermano/a participante".
  if (!p?.acepto_reglas_en) return { nombre: NOMBRE_SIN_PERMISO, avatar: null, conPermiso: false };
  return { nombre: (p.display_name ?? "").trim() || "Jugador", avatar: p.avatar_url, conPermiso: true };
}
```

  - Quitar `nombreCorto` del import si queda sin uso.

- [ ] **Step 7: Palabra del Día, TikTok (`puntos.server.ts`).**
  - En `perfiles()`, el select pasa a `"id, display_name, avatar_url, iglesia_id, role, acepto_reglas_en"` (el `iglesia_id` se usa en la Task 12).
  - `tiktok: p.tiktok_permiso === true` pasa a `tiktok: Boolean(p.acepto_reglas_en)`.
  - En `getTarjetaTikTok`, `nombre: nombreCorto(p.nombre)` pasa a `nombre: p.nombre`.
  - Actualizar el comentario de arriba de `getTarjetaTikTok`: "Con nombre para mostrar y foto quien aceptó la regla general; quien nunca la aceptó sale como 'Hermano/a participante'".
  - Quitar `nombreCorto` del import si queda sin uso.

- [ ] **Step 8: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores. Revisar con `grep -rn "CasillaPermisoJuego\|PreguntaTikTokJuego\|PermisoTikTok\|tiktok_permiso" src` que solo queden los archivos sin uso (`PermisoVideosJuegos.tsx`, `PreguntaTikTokJuego.tsx`, `palabra/PermisoTikTok.tsx`, `palabra/PreguntaTikTok.tsx`, `api/cuenta/tiktok`) y `PalabraResultado.tsx` (que sigue importándolos, pero con `tiktok = null` no los muestra).

```bash
git add -A src
git commit -m "Quitar la casilla de permiso: tarjetas y videos usan la regla general"
```

---

### Task 6: Conectar los 4 juegos a la Liga

**Files:**
- Modify: `src/app/api/juegos/palabra/intento/route.ts`, `src/app/api/arena-publica/answer/route.ts`, `src/app/api/ruleta/[codigo]/guess-consonant/route.ts`, `src/app/api/ruleta/[codigo]/guess-vowel/route.ts`, `src/app/api/ruleta/[codigo]/resolve/route.ts`, `src/lib/juegos/ahorcado.server.ts`

- [ ] **Step 1: Palabra del Día.** `import { NextResponse, after } from "next/server";`, `import { registrarPuntosLiga } from "@/lib/liga/registrar.server";`, `import { puntosPalabraLiga } from "@/lib/liga/config";`. Antes de `await recalcularRacha(user.id, service);`:

```ts
  if (resuelta) {
    const jugador = user.id;
    after(() =>
      registrarPuntosLiga({ jugador, juego: "palabra", puntos: puntosPalabraLiga(intentos.length), partidaRef: hoy, eventoRef: hoy })
    );
  }
```

- [ ] **Step 2: Trivia en línea (`answer/route.ts`).** Imports `{ NextResponse, after }`, `registrarPuntosLiga`, `LIGA_PUNTOS`. Después de `if (pregunta.question_id) await registrarRespuesta(...)`:

```ts
  if (esCorrecta) {
    after(() =>
      registrarPuntosLiga({ jugador: user.id, juego: "trivia", puntos: LIGA_PUNTOS.triviaPorCorrecta, partidaRef: sala.id, eventoRef: pregunta.id })
    );
  }
```

- [ ] **Step 3: Ruleta, consonante.** Imports igual. En la rama `count > 0`, el select del jugador pasa a `.select("id, puntos, user_id")`. Antes de `await channel.send({` de esa rama:

```ts
    if (jugador?.user_id) {
      const userId = jugador.user_id as string;
      after(() =>
        registrarPuntosLiga({ jugador: userId, juego: "ruleta", puntos: LIGA_PUNTOS.ruletaPorLetra, partidaRef: sala.id, eventoRef: `${ronda.id}:${letra}` })
      );
    }
```

- [ ] **Step 4: Ruleta, vocal.** Imports igual. En la rama `count > 0`, `jugadorFresco` se selecciona con `.select("id, puntos, user_id")`. Después de actualizar la ronda sin error y antes del `channel.send`, el mismo bloque del Step 3 con `jugadorFresco` en lugar de `jugador` (y los nombres de `ronda`/`letra` de ese archivo).

- [ ] **Step 5: Ruleta, resolver.** Imports igual. En la rama `acierto`, `jugadorFresco` con `.select("id, puntos, user_id")`. Antes de `await channel.send({`:

```ts
    if (jugadorFresco.user_id) {
      const userId = jugadorFresco.user_id as string;
      after(() =>
        registrarPuntosLiga({ jugador: userId, juego: "ruleta", puntos: LIGA_PUNTOS.ruletaPorResolver, partidaRef: sala.id, eventoRef: `${ronda.id}:resolver` })
      );
    }
```

- [ ] **Step 6: Ahorcado (`ahorcado.server.ts`).** Imports `after` de `next/server`, `registrarPuntosLiga`, `LIGA_PUNTOS`. En `adivinarLetra`, después de `if (estado === "ganada") nuevoRecord = await guardarRanking(...)`:

```ts
  if (estado === "ganada") {
    const ref = `${corrida.palabra_id ?? "sin-palabra"}:${actualizada.updated_at}`;
    after(() => registrarPuntosLiga({ jugador: userId, juego: "ahorcado", puntos: LIGA_PUNTOS.ahorcadoPorPalabra, partidaRef: ref, eventoRef: ref }));
  }
```

- [ ] **Step 7: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/app/api/juegos/palabra/intento/route.ts src/app/api/arena-publica/answer/route.ts "src/app/api/ruleta/[codigo]" src/lib/juegos/ahorcado.server.ts
git commit -m "Liga: los 4 juegos registran puntos al validar en el servidor"
```

---

### Task 7: Consultas de la Liga

**Files:**
- Create: `src/lib/liga/consultas.server.ts`

- [ ] **Step 1: Escribir las consultas**

```ts
// src/lib/liga/consultas.server.ts
//
// Lecturas de la Liga con service role (liga_puntos no se lee desde el
// navegador). De los jugadores solo sale el nombre para mostrar y la foto
// de quien aceptó la regla general; los demás, "Hermano/a participante".
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { fechaDeHoy } from "@/lib/palabra/servidor";
import { inicioDeSemana, sumarDias } from "@/lib/palabra/logica";
import { NOMBRE_SIN_PERMISO } from "@/lib/palabra/puntos";
import { COLUMNAS_IGLESIA, nombreIglesia, type Comunidad, type IglesiaBase } from "./nombre";

type Servicio = Awaited<ReturnType<typeof createServiceClient>>;

export interface FilaLiga {
  id: string;
  lugar: number;
  nombre: string;
  comunidad: Comunidad;
  puntos: number;
  jugadores: number;
  campeona: boolean;
}

export interface JugadorLiga {
  lugar: number;
  nombre: string;
  avatar: string | null;
  puntos: number;
  esYo: boolean;
}

export interface MiIglesiaLiga {
  id: string;
  nombre: string;
  comunidad: Comunidad;
  aprobada: boolean;
  lugar: number | null;
  puntos: number;
  faltan: number | null;
  siguiente: { nombre: string; comunidad: Comunidad } | null;
  campeona: boolean;
}

export interface TablaLiga {
  semana: string;
  conSesion: boolean;
  aceptoReglas: boolean;
  top: FilaLiga[];
  mia: MiIglesiaLiga | null;
  jugadores: JugadorLiga[];
}

export interface CampeonaLiga {
  semana: string;
  nombre: string;
  puntos: number;
  jugadores: number;
}

export interface MiIglesia {
  id: string;
  nombre: string;
  comunidad: Comunidad;
  aprobada: boolean;
}

interface FilaSql {
  iglesia_id: string;
  puntos: number;
  jugadores: number;
}

export function semanaActual(): string {
  return inicioDeSemana(fechaDeHoy());
}

export async function aprobadas(service: Servicio): Promise<IglesiaBase[]> {
  const { data } = await service.from("iglesias").select(COLUMNAS_IGLESIA).eq("aprobada", true);
  return (data ?? []) as IglesiaBase[];
}

async function campeonaDe(service: Servicio, semana: string): Promise<string | null> {
  const { data } = await service.from("liga_campeonas").select("iglesia_id").eq("semana", semana).maybeSingle();
  return (data?.iglesia_id as string | null | undefined) ?? null;
}

async function tablaSql(service: Servicio, semana: string): Promise<FilaSql[]> {
  const { data, error } = await service.rpc("liga_tabla_semana", { p_semana: semana });
  if (error) {
    console.error("[liga] tabla:", error.message);
    return [];
  }
  return (data ?? []) as FilaSql[];
}

export async function getMiIglesia(
  userId: string,
  service?: Servicio
): Promise<{ iglesia: MiIglesia | null; preguntada: boolean; cambiadaEn: string | null }> {
  const s = service ?? (await createServiceClient());
  const { data: perfil } = await s
    .from("profiles")
    .select("iglesia_id, iglesia_preguntada, iglesia_cambiada_en")
    .eq("id", userId)
    .maybeSingle();
  const preguntada = perfil?.iglesia_preguntada === true;
  const cambiadaEn = (perfil?.iglesia_cambiada_en as string | null | undefined) ?? null;
  const id = (perfil?.iglesia_id as string | null | undefined) ?? null;
  if (!id) return { iglesia: null, preguntada, cambiadaEn };
  const [{ data: fila }, todas] = await Promise.all([
    s.from("iglesias").select(`${COLUMNAS_IGLESIA}, aprobada`).eq("id", id).maybeSingle(),
    aprobadas(s),
  ]);
  if (!fila) return { iglesia: null, preguntada, cambiadaEn };
  const ig = fila as IglesiaBase & { aprobada: boolean };
  return { iglesia: { id, nombre: nombreIglesia(ig, todas), comunidad: ig.comunidad, aprobada: ig.aprobada === true }, preguntada, cambiadaEn };
}

async function perfilesPublicos(
  service: Servicio,
  ids: string[]
): Promise<Map<string, { nombre: string; avatar: string | null; acepto: boolean }>> {
  const mapa = new Map<string, { nombre: string; avatar: string | null; acepto: boolean }>();
  if (ids.length === 0) return mapa;
  const { data } = await service.from("profiles").select("id, display_name, avatar_url, acepto_reglas_en").in("id", ids);
  for (const p of (data ?? []) as Array<Record<string, unknown>>) {
    mapa.set(p.id as string, {
      nombre: ((p.display_name as string | null) ?? "").trim() || "Jugador",
      avatar: (p.avatar_url as string | null) ?? null,
      acepto: Boolean(p.acepto_reglas_en),
    });
  }
  return mapa;
}

export async function getTablaLiga(userId: string | null, aceptoReglas = false): Promise<TablaLiga> {
  const service = await createServiceClient();
  const semana = semanaActual();
  const [todas, filas, campeonaId, mi] = await Promise.all([
    aprobadas(service),
    tablaSql(service, semana),
    campeonaDe(service, sumarDias(semana, -7)),
    userId ? getMiIglesia(userId, service) : Promise.resolve(null),
  ]);
  const porId = new Map(todas.map((i) => [i.id, i]));

  const conLugar: FilaLiga[] = filas.map((f, i) => {
    const ig = porId.get(f.iglesia_id);
    return {
      id: f.iglesia_id,
      lugar: i + 1,
      nombre: ig ? nombreIglesia(ig, todas) : "Equipo",
      comunidad: ig?.comunidad ?? "otra",
      puntos: f.puntos,
      jugadores: f.jugadores,
      campeona: f.iglesia_id === campeonaId,
    };
  });

  let mia: MiIglesiaLiga | null = null;
  const propia = mi?.iglesia ?? null;
  if (propia) {
    const idx = conLugar.findIndex((f) => f.id === propia.id);
    const fila = idx >= 0 ? conLugar[idx] : null;
    const arriba = idx > 0 ? conLugar[idx - 1] : idx < 0 && conLugar.length > 0 ? conLugar[conLugar.length - 1] : null;
    const puntos = fila?.puntos ?? 0;
    mia = {
      id: propia.id,
      nombre: propia.nombre,
      comunidad: propia.comunidad,
      aprobada: propia.aprobada,
      lugar: fila?.lugar ?? null,
      puntos,
      faltan: propia.aprobada && arriba ? arriba.puntos - puntos + 1 : null,
      siguiente: propia.aprobada && arriba ? { nombre: arriba.nombre, comunidad: arriba.comunidad } : null,
      campeona: propia.id === campeonaId,
    };
  }

  let jugadores: JugadorLiga[] = [];
  if (propia) {
    const { data } = await service.rpc("liga_jugadores_semana", { p_semana: semana, p_iglesia: propia.id, p_limite: 10 });
    const lista = (data ?? []) as Array<{ jugador: string; puntos: number }>;
    const perfiles = await perfilesPublicos(service, lista.map((j) => j.jugador));
    jugadores = lista.map((j, i) => {
      const p = perfiles.get(j.jugador);
      return {
        lugar: i + 1,
        nombre: p?.acepto ? p.nombre : NOMBRE_SIN_PERMISO,
        avatar: p?.acepto ? p.avatar : null,
        puntos: j.puntos,
        esYo: j.jugador === userId,
      };
    });
  }

  return { semana, conSesion: userId !== null, aceptoReglas, top: conLugar.slice(0, 10), mia, jugadores };
}

export async function getHistorialCampeonas(limite = 12): Promise<CampeonaLiga[]> {
  const service = await createServiceClient();
  const [{ data }, todas] = await Promise.all([
    service.from("liga_campeonas").select("semana, iglesia_id, puntos, jugadores").order("semana", { ascending: false }).limit(limite),
    aprobadas(service),
  ]);
  const porId = new Map(todas.map((i) => [i.id, i]));
  return ((data ?? []) as Array<{ semana: string; iglesia_id: string | null; puntos: number; jugadores: number }>).map((c) => {
    const ig = c.iglesia_id ? porId.get(c.iglesia_id) : undefined;
    return { semana: c.semana, nombre: ig ? nombreIglesia(ig, todas) : "Equipo que ya no existe", puntos: c.puntos, jugadores: c.jugadores };
  });
}

export interface DatosTarjetaLiga {
  semana: string;
  top3: Array<{ nombre: string; puntos: number }>;
  mejor: { nombre: string; avatar: string | null; puntos: number; equipo: string | null } | null;
}

/** Tarjeta de TikTok: top 3 y el mejor jugador SOLO si aceptó la regla. */
export async function getDatosTarjetaLiga(semana: string): Promise<DatosTarjetaLiga> {
  const service = await createServiceClient();
  const [todas, filas, { data: jug }] = await Promise.all([
    aprobadas(service),
    tablaSql(service, semana),
    service.rpc("liga_jugadores_semana", { p_semana: semana, p_iglesia: null, p_limite: 1 }),
  ]);
  const porId = new Map(todas.map((i) => [i.id, i]));
  const top3 = filas.slice(0, 3).map((f) => {
    const ig = porId.get(f.iglesia_id);
    return { nombre: ig ? nombreIglesia(ig, todas) : "Equipo", puntos: f.puntos };
  });
  let mejor: DatosTarjetaLiga["mejor"] = null;
  const primero = ((jug ?? []) as Array<{ jugador: string; puntos: number }>)[0];
  if (primero) {
    const p = (await perfilesPublicos(service, [primero.jugador])).get(primero.jugador);
    if (p?.acepto) {
      const { iglesia } = await getMiIglesia(primero.jugador, service);
      mejor = { nombre: p.nombre, avatar: p.avatar, puntos: primero.puntos, equipo: iglesia?.aprobada ? iglesia.nombre : null };
    }
  }
  return { semana, top3, mejor };
}

export async function getSemanasTarjeta(): Promise<string[]> {
  const service = await createServiceClient();
  const { data } = await service.from("liga_campeonas").select("semana").order("semana", { ascending: false }).limit(11);
  const actual = semanaActual();
  return [actual, ...((data ?? []) as Array<{ semana: string }>).map((c) => c.semana).filter((s) => s !== actual)];
}

export interface ResumenComunidades {
  lldm: number;
  otras: Array<{ denominacion: string; jugadores: number }>;
  amigos: number;
  sinElegir: number;
}

/** Para /admin/liga: jugadores (sin admins) por tipo de equipo, incluyendo equipos pendientes. */
export async function getResumenComunidades(): Promise<ResumenComunidades> {
  const service = await createServiceClient();
  const [{ data: igl }, { data: perf }] = await Promise.all([
    service.from("iglesias").select("id, comunidad, denominacion"),
    service.from("profiles").select("iglesia_id").neq("role", "admin"),
  ]);
  const tipo = new Map(((igl ?? []) as Array<{ id: string; comunidad: Comunidad; denominacion: string | null }>).map((i) => [i.id, i]));
  const r: ResumenComunidades = { lldm: 0, otras: [], amigos: 0, sinElegir: 0 };
  const otras = new Map<string, number>();
  for (const p of (perf ?? []) as Array<{ iglesia_id: string | null }>) {
    const ig = p.iglesia_id ? tipo.get(p.iglesia_id) : undefined;
    if (!ig) r.sinElegir += 1;
    else if (ig.comunidad === "lldm") r.lldm += 1;
    else if (ig.comunidad === "amigos") r.amigos += 1;
    else otras.set(ig.denominacion ?? "Otra", (otras.get(ig.denominacion ?? "Otra") ?? 0) + 1);
  }
  r.otras = [...otras.entries()].map(([denominacion, jugadores]) => ({ denominacion, jugadores })).sort((a, b) => b.jugadores - a.jugadores);
  return r;
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/lib/liga/consultas.server.ts
git commit -m "Liga: consultas de tabla, mi equipo, campeonas, tarjeta y resumen"
```

---

### Task 8: API de la Liga

**Files:**
- Create: `src/app/api/liga/iglesias/route.ts`, `src/app/api/liga/mi-iglesia/route.ts`, `src/app/api/liga/no-preguntar/route.ts`, `src/app/api/liga/tabla/route.ts`

- [ ] **Step 1: Buscar**

```ts
// src/app/api/liga/iglesias/route.ts
// Busca equipos aprobados del tipo elegido (LLDM, o una denominación) por ciudad.
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { COLUMNAS_IGLESIA, detalleIglesia, nombreIglesia, normalizar, type IglesiaBase } from "@/lib/liga/nombre";
import { esDenominacion } from "@/lib/liga/config";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = normalizar(params.get("q"));
  const comunidad = params.get("comunidad");
  const denominacion = params.get("denominacion");
  if (q.length < 2 || (comunidad !== "lldm" && comunidad !== "otra")) return NextResponse.json({ iglesias: [] });
  if (comunidad === "otra" && !esDenominacion(denominacion)) return NextResponse.json({ iglesias: [] });

  const service = await createServiceClient();
  const { data, error } = await service.from("iglesias").select(COLUMNAS_IGLESIA).eq("aprobada", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const todas = (data ?? []) as IglesiaBase[];

  const coinciden = todas
    .filter((i) => i.comunidad === comunidad && (comunidad === "lldm" || i.denominacion === denominacion))
    .filter((i) => normalizar(i.ciudad).includes(q) || normalizar(`${i.ciudad} ${i.estado} ${i.pais}`).includes(q))
    .sort((a, b) => Number(!normalizar(a.ciudad).startsWith(q)) - Number(!normalizar(b.ciudad).startsWith(q)) || (a.ciudad ?? "").localeCompare(b.ciudad ?? ""))
    .slice(0, 10)
    .map((i) => ({ id: i.id, nombre: nombreIglesia(i, todas), detalle: detalleIglesia(i) }));

  return NextResponse.json({ iglesias: coinciden });
}
```

- [ ] **Step 2: Elegir, agregar o ir a Amigos de Elim**

```ts
// src/app/api/liga/mi-iglesia/route.ts
//
// { iglesia_id } elige un equipo aprobado; { amigos: true } va a "Amigos
// de Elim"; { nueva: { comunidad, denominacion?, ciudad, estado, pais },
// confirmar? } agrega uno (queda pendiente). Cambiar: una vez cada 30
// días; la primera elección no cuenta, y salir de Amigos de Elim siempre
// se permite.
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { aceptoReglas, faltaAceptarReglas } from "@/lib/reglas.server";
import { COLUMNAS_IGLESIA, claveIglesia, detalleIglesia, limpiar, nombreIglesia, normalizar, type Comunidad, type IglesiaBase } from "@/lib/liga/nombre";
import { LIGA_DIAS_CAMBIO, esDenominacion } from "@/lib/liga/config";

const DIA_MS = 86_400_000;

function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const t = limpiar(valor);
  return t.length >= 1 && t.length <= 60 ? t : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para elegir tu equipo" }, { status: 401 });
  if (!(await aceptoReglas(user.id))) return faltaAceptarReglas();

  let body: {
    iglesia_id?: unknown;
    amigos?: unknown;
    nueva?: { comunidad?: unknown; denominacion?: unknown; ciudad?: unknown; estado?: unknown; pais?: unknown };
    confirmar?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: perfil } = await service.from("profiles").select("iglesia_id, iglesia_cambiada_en").eq("id", user.id).maybeSingle();
  if (!perfil) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  const anteriorId = (perfil.iglesia_id as string | null) ?? null;

  const { data: aprobData } = await service.from("iglesias").select(COLUMNAS_IGLESIA).eq("aprobada", true);
  const aprobadas = (aprobData ?? []) as IglesiaBase[];
  const anterior = anteriorId ? (aprobadas.find((i) => i.id === anteriorId) ?? null) : null;

  let destino: (IglesiaBase & { aprobada: boolean }) | null = null;

  if (body.amigos === true) {
    const amigos = aprobadas.find((i) => i.comunidad === "amigos");
    if (!amigos) return NextResponse.json({ error: "Amigos de Elim no está disponible" }, { status: 500 });
    destino = { ...amigos, aprobada: true };
  } else if (typeof body.iglesia_id === "string") {
    const elegida = aprobadas.find((i) => i.id === body.iglesia_id);
    if (!elegida) return NextResponse.json({ error: "Ese equipo no está disponible" }, { status: 404 });
    destino = { ...elegida, aprobada: true };
  } else if (body.nueva) {
    const comunidad = body.nueva.comunidad;
    if (comunidad !== "lldm" && comunidad !== "otra") return NextResponse.json({ error: "Elige si eres LLDM o de otra iglesia" }, { status: 400 });
    const denominacion = comunidad === "otra" ? body.nueva.denominacion : null;
    if (comunidad === "otra" && !esDenominacion(denominacion)) return NextResponse.json({ error: "Elige tu denominación de la lista" }, { status: 400 });
    const ciudad = texto(body.nueva.ciudad);
    const estado = texto(body.nueva.estado);
    const pais = texto(body.nueva.pais);
    if (!ciudad || !estado || !pais) return NextResponse.json({ error: "Escribe ciudad, estado y país (máximo 60 letras cada uno)" }, { status: 400 });
    const den = (denominacion as string | null) ?? null;
    const clave = claveIglesia(comunidad, den, ciudad, estado, pais);

    const { data: existente } = await service.from("iglesias").select(`${COLUMNAS_IGLESIA}, aprobada`).eq("clave", clave).maybeSingle();
    if (existente) {
      destino = existente as IglesiaBase & { aprobada: boolean };
    } else {
      const similares = aprobadas.filter(
        (i) => i.comunidad === comunidad && (i.denominacion ?? null) === den && normalizar(i.ciudad) === normalizar(ciudad)
      );
      if (similares.length > 0 && body.confirmar !== true) {
        return NextResponse.json({ similares: similares.map((i) => ({ id: i.id, nombre: nombreIglesia(i, aprobadas), detalle: detalleIglesia(i) })) });
      }
      const { data: creada, error } = await service
        .from("iglesias")
        .insert({ comunidad, denominacion: den, ciudad, estado, pais, clave, aprobada: false, creada_por: user.id })
        .select(`${COLUMNAS_IGLESIA}, aprobada`)
        .single();
      if (error || !creada) return NextResponse.json({ error: error?.message ?? "No se pudo agregar" }, { status: 500 });
      destino = creada as IglesiaBase & { aprobada: boolean };
    }
  } else {
    return NextResponse.json({ error: "Elige o agrega tu iglesia" }, { status: 400 });
  }

  const respuesta = () =>
    NextResponse.json({
      iglesia: { id: destino!.id, nombre: nombreIglesia(destino!, aprobadas), comunidad: destino!.comunidad as Comunidad, aprobada: destino!.aprobada },
    });

  if (anteriorId === destino.id) return respuesta();

  const salirDeAmigos = anterior?.comunidad === "amigos";
  if (anteriorId && !salirDeAmigos) {
    const ultima = perfil.iglesia_cambiada_en ? Date.parse(perfil.iglesia_cambiada_en as string) : 0;
    const libre = ultima + LIGA_DIAS_CAMBIO * DIA_MS;
    if (ultima && Date.now() < libre) {
      const fecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "America/Los_Angeles" }).format(new Date(libre));
      return NextResponse.json({ error: `Solo puedes cambiar de equipo una vez cada ${LIGA_DIAS_CAMBIO} días. Podrás cambiarlo el ${fecha}.` }, { status: 409 });
    }
  }

  const { error: errPerfil } = await service
    .from("profiles")
    .update({ iglesia_id: destino.id, iglesia_preguntada: true, ...(anteriorId ? { iglesia_cambiada_en: new Date().toISOString() } : {}) })
    .eq("id", user.id);
  if (errPerfil) return NextResponse.json({ error: errPerfil.message }, { status: 500 });

  if (!anteriorId) await service.rpc("liga_asignar_sin_iglesia", { p_jugador: user.id, p_iglesia: destino.id });

  return respuesta();
}
```

- [ ] **Step 3: "Ahora no"**

```ts
// src/app/api/liga/no-preguntar/route.ts
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  const service = await createServiceClient();
  const { error } = await service.from("profiles").update({ iglesia_preguntada: true }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Tabla**

```ts
// src/app/api/liga/tabla/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTablaLiga } from "@/lib/liga/consultas.server";
import { aceptoReglas } from "@/lib/reglas.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const acepto = user ? await aceptoReglas(user.id) : false;
  const tabla = await getTablaLiga(user?.id ?? null, acepto);
  return NextResponse.json(tabla, { headers: { "Cache-Control": "no-store" } });
}
```

- [ ] **Step 5: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/app/api/liga
git commit -m "Liga: API para buscar, elegir y agregar equipo, y tabla"
```

---

### Task 9: Selector de equipo y avisos en los juegos

**Files:**
- Create: `src/components/juegos/liga/SelectorIglesia.tsx`, `src/components/juegos/liga/AvisoIglesia.tsx`, `src/components/juegos/liga/AvisosJuego.tsx`
- Modify: `src/app/(public)/juegos/palabra/page.tsx`, `src/app/(public)/arena-abierta/page.tsx`, `src/app/(public)/ruleta/page.tsx`, `src/app/(public)/juegos/ahorcado/page.tsx`, `src/app/(public)/juegos/page.tsx`

- [ ] **Step 1: `SelectorIglesia.tsx`**

```tsx
// src/components/juegos/liga/SelectorIglesia.tsx
//
// Paso 1: "¿Perteneces a la Iglesia La Luz del Mundo?". Paso 1b (otra
// iglesia): denominación. Paso 2: ciudad (buscar o agregar). "No
// pertenezco a ninguna" y "Prefiero no decir" van a Amigos de Elim.
"use client";

import { useEffect, useState } from "react";
import { Church, Loader2, Plus, Search } from "lucide-react";
import { DENOMINACIONES, type Denominacion } from "@/lib/liga/config";
import type { Comunidad } from "@/lib/liga/nombre";

export interface IglesiaElegida {
  id: string;
  nombre: string;
  comunidad: Comunidad;
  aprobada: boolean;
}

interface Opcion {
  id: string;
  nombre: string;
  detalle: string;
}

type Paso = "pregunta" | "denominacion" | "ciudad" | "agregar" | "similares";

const campo = { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" } as const;
const botonGrande = "w-full p-3 rounded-xl text-left text-sm font-semibold min-h-12";

export function SelectorIglesia({ onElegida }: { onElegida: (iglesia: IglesiaElegida) => void }) {
  const [paso, setPaso] = useState<Paso>("pregunta");
  const [comunidad, setComunidad] = useState<"lldm" | "otra">("lldm");
  const [denominacion, setDenominacion] = useState<Denominacion | null>(null);
  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [nueva, setNueva] = useState({ ciudad: "", estado: "", pais: "" });
  const [similares, setSimilares] = useState<Opcion[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paso !== "ciudad" || q.trim().length < 2) {
      setOpciones([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const params = new URLSearchParams({ q, comunidad, ...(denominacion ? { denominacion } : {}) });
        const res = await fetch(`/api/liga/iglesias?${params.toString()}`);
        const data = (await res.json()) as { iglesias?: Opcion[] };
        setOpciones(data.iglesias ?? []);
      } catch {
        setOpciones([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, paso, comunidad, denominacion]);

  async function enviar(cuerpo: object) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/liga/mi-iglesia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const data = (await res.json()) as { iglesia?: IglesiaElegida; similares?: Opcion[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      if (data.similares) {
        setSimilares(data.similares);
        setPaso("similares");
        return;
      }
      if (data.iglesia) onElegida(data.iglesia);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  const nuevaCompleta = { comunidad, denominacion, ...nueva };
  const errorTexto = error && <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{error}</p>;
  const lista = (items: Opcion[]) => (
    <ul className="flex flex-col gap-2">
      {items.map((o) => (
        <li key={o.id}>
          <button type="button" disabled={guardando} onClick={() => void enviar({ iglesia_id: o.id })} className="w-full flex items-center gap-3 p-3 rounded-xl text-left min-h-11" style={campo}>
            <Church size={18} style={{ color: "var(--color-primary)" }} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">{o.nombre}</span>
              <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{o.detalle}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
  const volver = (a: Paso) => (
    <button type="button" onClick={() => setPaso(a)} className="text-sm underline min-h-11" style={{ color: "var(--color-text-muted)" }}>Volver</button>
  );

  if (paso === "pregunta") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>¿Perteneces a la Iglesia La Luz del Mundo?</p>
        <button type="button" className={botonGrande} style={campo} onClick={() => { setComunidad("lldm"); setDenominacion(null); setPaso("ciudad"); }}>Sí</button>
        <button type="button" className={botonGrande} style={campo} onClick={() => { setComunidad("otra"); setPaso("denominacion"); }}>No, soy de otra iglesia</button>
        <button type="button" disabled={guardando} className={botonGrande} style={campo} onClick={() => void enviar({ amigos: true })}>No pertenezco a ninguna</button>
        <button type="button" disabled={guardando} className={botonGrande} style={campo} onClick={() => void enviar({ amigos: true })}>Prefiero no decir</button>
        {errorTexto}
      </div>
    );
  }

  if (paso === "denominacion") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>¿De qué iglesia eres?</p>
        <div className="grid grid-cols-2 gap-2">
          {DENOMINACIONES.map((d) => (
            <button key={d} type="button" className="p-3 rounded-xl text-sm font-semibold min-h-12" style={campo} onClick={() => { setDenominacion(d); setPaso("ciudad"); }}>{d}</button>
          ))}
        </div>
        {volver("pregunta")}
      </div>
    );
  }

  if (paso === "similares") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: "var(--color-text)" }}>¿Es alguna de estas?</p>
        {lista(similares)}
        <button type="button" disabled={guardando} onClick={() => void enviar({ nueva: nuevaCompleta, confirmar: true })} className="py-2.5 rounded-xl text-sm font-semibold min-h-11" style={{ ...campo, color: "var(--color-text-muted)" }}>
          No, agregar {nueva.ciudad} como nueva
        </button>
        {errorTexto}
      </div>
    );
  }

  if (paso === "agregar") {
    const listo = nueva.ciudad.trim() && nueva.estado.trim() && nueva.pais.trim();
    return (
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (listo) void enviar({ nueva: nuevaCompleta }); }}>
        {(["ciudad", "estado", "pais"] as const).map((c) => (
          <input key={c} value={nueva[c]} onChange={(e) => setNueva({ ...nueva, [c]: e.target.value })} maxLength={60} placeholder={c === "ciudad" ? "Ciudad" : c === "estado" ? "Estado o provincia" : "País"} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={campo} />
        ))}
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Queda pendiente hasta que la aprobemos. Tus puntos se guardan desde ya.</p>
        {errorTexto}
        <div className="flex gap-2">
          <button type="button" onClick={() => setPaso("ciudad")} className="flex-1 py-2.5 rounded-xl text-sm min-h-11" style={{ ...campo, color: "var(--color-text-muted)" }}>Volver</button>
          <button type="submit" disabled={!listo || guardando} className="flex-1 py-2.5 rounded-xl text-sm font-bold min-h-11 disabled:opacity-60" style={{ background: "var(--color-primary)", color: "#000" }}>{guardando ? "Guardando…" : "Agregar"}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        {comunidad === "lldm" ? "¿En qué ciudad está tu iglesia?" : `${denominacion}: ¿en qué ciudad?`}
      </p>
      <label className="flex items-center gap-2 rounded-xl px-3" style={campo}>
        <Search size={16} style={{ color: "var(--color-text-muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe tu ciudad" className="flex-1 bg-transparent py-2.5 text-sm outline-none" autoFocus />
        {buscando && <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />}
      </label>
      {opciones.length > 0 && lista(opciones)}
      {q.trim().length >= 2 && !buscando && opciones.length === 0 && <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Todavía no está tu ciudad.</p>}
      <button type="button" onClick={() => { setNueva({ ciudad: q.trim(), estado: "", pais: "" }); setPaso("agregar"); }} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold min-h-11" style={{ border: "1px dashed var(--color-border)", color: "var(--color-primary)" }}>
        <Plus size={16} /> Mi ciudad no aparece
      </button>
      {errorTexto}
      {volver(comunidad === "lldm" ? "pregunta" : "denominacion")}
    </div>
  );
}
```

- [ ] **Step 2: `AvisoIglesia.tsx`**

```tsx
// src/components/juegos/liga/AvisoIglesia.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { enFrase } from "@/lib/liga/nombre";
import { SelectorIglesia, type IglesiaElegida } from "./SelectorIglesia";

export function AvisoIglesia() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(true);
  const [elegida, setElegida] = useState<IglesiaElegida | null>(null);
  if (!abierto) return null;

  async function ahoraNo() {
    setAbierto(false);
    try {
      await fetch("/api/liga/no-preguntar", { method: "POST" });
    } catch {
      // Si falla, se le vuelve a preguntar la próxima vez.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} role="dialog" aria-modal="true" aria-labelledby="aviso-iglesia-titulo">
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--color-surface)", border: "1px solid rgba(212,160,23,0.4)" }}>
        {elegida ? (
          <>
            <p id="aviso-iglesia-titulo" className="text-lg font-bold" style={{ color: "var(--color-text)" }}>¡Listo! 🙌</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {elegida.aprobada
                ? `Tus puntos sumarán para ${enFrase(elegida.nombre, elegida.comunidad)}.`
                : `Agregamos ${enFrase(elegida.nombre, elegida.comunidad)}. Cuando la aprobemos, tus puntos empezarán a sumar.`}
            </p>
            <button type="button" onClick={() => { setAbierto(false); router.refresh(); }} className="py-2.5 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
              A jugar
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Trophy size={20} style={{ color: "var(--color-primary)" }} />
              <p id="aviso-iglesia-titulo" className="text-lg font-bold" style={{ color: "var(--color-text)" }}>En Elim LLDM todos son bienvenidos. ¿De qué iglesia eres?</p>
            </div>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Tus puntos sumarán para tu equipo en la Liga.</p>
            <SelectorIglesia onElegida={setElegida} />
            <button type="button" onClick={() => void ahoraNo()} className="text-sm underline min-h-11" style={{ color: "var(--color-text-muted)" }}>Ahora no</button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `AvisosJuego.tsx`**

```tsx
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
```

- [ ] **Step 4: Montarlo.** Importar `import { AvisosJuego, type PerfilAvisos } from "@/components/juegos/liga/AvisosJuego";` y, en el `return (` **final** de cada página, poner como primer hijo del `<div>` de afuera:

```tsx
      <AvisosJuego perfil={profile as PerfilAvisos | null} />
```

Páginas: `juegos/palabra/page.tsx`, `arena-abierta/page.tsx`, `ruleta/page.tsx`, `juegos/ahorcado/page.tsx`. En `/juegos` (`juegos/page.tsx`) se monta con `preguntarIglesia={false}`: en el vestíbulo solo se pide la regla.

- [ ] **Step 5: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/components/juegos/liga "src/app/(public)/juegos/palabra/page.tsx" "src/app/(public)/arena-abierta/page.tsx" "src/app/(public)/ruleta/page.tsx" "src/app/(public)/juegos/ahorcado/page.tsx" "src/app/(public)/juegos/page.tsx"
git commit -m "Liga: avisos de regla y de equipo al entrar a los juegos"
```

---

### Task 10: Página /juegos/liga y tarjeta en /juegos

**Files:**
- Create: `src/components/juegos/liga/InvitarHermanos.tsx`, `src/components/juegos/liga/TablaLiga.tsx`, `src/components/juegos/liga/TarjetaLigaHub.tsx`, `src/app/(public)/juegos/liga/page.tsx`
- Modify: `src/app/(public)/juegos/page.tsx`

- [ ] **Step 1: `InvitarHermanos.tsx`**

```tsx
// src/components/juegos/liga/InvitarHermanos.tsx
"use client";

import { MessageCircle, Share2 } from "lucide-react";
import { textoInvitacion } from "@/lib/liga/config";

export function InvitarHermanos({ equipoEnFrase }: { equipoEnFrase: string | null }) {
  const texto = textoInvitacion(equipoEnFrase);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(texto)}`;

  async function compartir() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: texto });
      } catch {
        // Canceló: no se abre nada más.
      }
      return;
    }
    window.open(whatsapp, "_blank", "noopener");
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => void compartir()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
        <Share2 size={16} /> Invitar a mis hermanos
      </button>
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Invitar por WhatsApp" className="flex items-center justify-center px-4 rounded-xl min-h-11" style={{ background: "#25D366", color: "#000" }}>
        <MessageCircle size={18} />
      </a>
    </div>
  );
}
```

- [ ] **Step 2: `TablaLiga.tsx`**

```tsx
// src/components/juegos/liga/TablaLiga.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Church, LogIn } from "lucide-react";
import type { TablaLiga as Tabla } from "@/lib/liga/consultas.server";
import { LIGA_REFRESCO_MS } from "@/lib/liga/config";
import { enFrase } from "@/lib/liga/nombre";
import { InvitarHermanos } from "./InvitarHermanos";
import { SelectorIglesia } from "./SelectorIglesia";

const caja = { background: "var(--color-surface)", border: "1px solid var(--color-border)" } as const;
const botonOro = "self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold min-h-11";

export function TablaLiga({ inicial }: { inicial: Tabla }) {
  const router = useRouter();
  const [tabla, setTabla] = useState(inicial);
  const [eligiendo, setEligiendo] = useState(false);

  useEffect(() => setTabla(inicial), [inicial]);
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/liga/tabla", { cache: "no-store" });
        if (res.ok) setTabla((await res.json()) as Tabla);
      } catch {
        // Se intenta de nuevo en 30 segundos.
      }
    }, LIGA_REFRESCO_MS);
    return () => clearInterval(id);
  }, []);

  const { mia, top, jugadores } = tabla;
  const maximo = top[0]?.puntos ?? 0;
  const miFrase = mia ? enFrase(mia.nombre, mia.comunidad, true) : "";

  let cabecera: React.ReactNode;
  if (!tabla.conSesion) {
    cabecera = (
      <>
        <p className="text-sm" style={{ color: "var(--color-text)" }}>Entra a tu cuenta para que tus puntos sumen para tu equipo.</p>
        <Link href="/login?returnUrl=/juegos/liga" className={botonOro} style={{ background: "var(--color-primary)", color: "#000" }}><LogIn size={16} /> Iniciar sesión</Link>
      </>
    );
  } else if (!mia) {
    cabecera = eligiendo && tabla.aceptoReglas ? (
      <SelectorIglesia onElegida={() => { setEligiendo(false); router.refresh(); }} />
    ) : (
      <>
        <p className="text-sm" style={{ color: "var(--color-text)" }}>En Elim LLDM todos son bienvenidos. ¿De qué iglesia eres? Tus puntos sumarán para tu equipo.</p>
        {tabla.aceptoReglas && (
          <button type="button" onClick={() => setEligiendo(true)} className={botonOro} style={{ background: "var(--color-primary)", color: "#000" }}><Church size={16} /> Elegir mi equipo</button>
        )}
      </>
    );
  } else if (!mia.aprobada) {
    cabecera = <p className="text-sm" style={{ color: "var(--color-text)" }}><strong>{mia.nombre}</strong> está esperando aprobación. Tus puntos ya se están guardando.</p>;
  } else {
    cabecera = (
      <>
        <p className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
          {mia.lugar ? `${miFrase}${mia.campeona ? " 🏆" : ""} va en el lugar #${mia.lugar}` : `${miFrase}${mia.campeona ? " 🏆" : ""} todavía no tiene puntos esta semana`}
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {mia.lugar === 1
            ? "¡Van en primer lugar! Invita a tus hermanos para no perderlo."
            : mia.faltan && mia.siguiente
              ? `¡Les faltan ${mia.faltan} puntos para pasar a ${enFrase(mia.siguiente.nombre, mia.siguiente.comunidad)}! Invita a tus hermanos.`
              : "¡Jueguen para entrar a la tabla! Invita a tus hermanos."}
        </p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "linear-gradient(135deg, rgba(212,160,23,0.14) 0%, var(--color-surface) 70%)", border: "1px solid rgba(212,160,23,0.45)" }}>
        {cabecera}
        <InvitarHermanos equipoEnFrase={mia?.aprobada ? enFrase(mia.nombre, mia.comunidad) : null} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Tabla de la semana</h2>
        {top.length === 0 ? (
          <p className="text-sm rounded-2xl p-5" style={{ ...caja, color: "var(--color-text-muted)" }}>Todavía no hay puntos esta semana. ¡Juega y pon a tu equipo en la tabla!</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {top.map((f) => (
              <li key={f.id} className="rounded-xl p-3 flex flex-col gap-2" style={{ ...caja, borderColor: f.id === mia?.id ? "rgba(212,160,23,0.6)" : "var(--color-border)" }}>
                <div className="flex items-center gap-3">
                  <span className="w-7 text-center text-sm font-bold tabular-nums" style={{ color: f.lugar <= 3 ? "var(--color-primary)" : "var(--color-text-muted)" }}>#{f.lugar}</span>
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>{f.nombre}{f.campeona ? " 🏆" : ""}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "var(--color-text)" }}>{f.puntos} pts</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-elevated)" }}>
                    <div className="h-full rounded-full" style={{ width: `${maximo ? Math.max(4, Math.round((f.puntos / maximo) * 100)) : 0}%`, background: "var(--color-primary)" }} />
                  </div>
                  <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>{f.jugadores} {f.jugadores === 1 ? "jugador" : "jugadores"}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {mia?.aprobada && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Los mejores de mi equipo esta semana</h2>
          {jugadores.length === 0 ? (
            <p className="text-sm rounded-2xl p-5" style={{ ...caja, color: "var(--color-text-muted)" }}>Nadie de tu equipo ha sumado puntos esta semana. ¡Sé el primero!</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {jugadores.map((j) => (
                <li key={j.lugar} className="flex items-center gap-3 rounded-xl p-3" style={{ ...caja, borderColor: j.esYo ? "rgba(212,160,23,0.6)" : "var(--color-border)" }}>
                  <span className="w-6 text-center text-sm font-bold tabular-nums" style={{ color: "var(--color-text-muted)" }}>{j.lugar}</span>
                  {j.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={j.avatar} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--color-surface-elevated)", color: "var(--color-primary)" }}>{j.nombre.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="flex-1 min-w-0 text-sm truncate" style={{ color: "var(--color-text)" }}>{j.nombre}{j.esYo ? " (tú)" : ""}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "var(--color-text)" }}>{j.puntos} pts</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
```

(Solo importa **el tipo** de `consultas.server.ts`, con `import type`, que se borra al compilar. Si el build se queja por `server-only`, mover las interfaces a `src/lib/liga/tipos.ts` y reexportarlas.)

- [ ] **Step 3: Página**

```tsx
// src/app/(public)/juegos/liga/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { aceptoVersionActual, TEXTO_PARA_TODOS } from "@/lib/reglas";
import { getHistorialCampeonas, getTablaLiga } from "@/lib/liga/consultas.server";
import { rangoSemana } from "@/lib/juegos/campeones/semana";
import { TablaLiga } from "@/components/juegos/liga/TablaLiga";
import { AvisosJuego, type PerfilAvisos } from "@/components/juegos/liga/AvisosJuego";

export const metadata: Metadata = {
  title: "Liga de Iglesias — Elim LLDM",
  description: "Juega y suma puntos para tu equipo. Todos son bienvenidos. Cada semana hay un equipo campeón.",
};
export const dynamic = "force-dynamic";

export default async function LigaPage() {
  const profile = (await getProfile()) as (PerfilAvisos & { id: string }) | null;
  const acepto = aceptoVersionActual(profile?.acepto_reglas_version);
  const [tabla, historial] = await Promise.all([getTablaLiga(profile?.id ?? null, acepto), getHistorialCampeonas()]);

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <AvisosJuego perfil={profile} />
      <div className="max-w-xl mx-auto px-4 py-8 pb-24 flex flex-col gap-6">
        <Link href="/juegos" className="inline-flex items-center gap-1 text-sm min-h-11" style={{ color: "var(--color-text-muted)" }}><ChevronLeft size={16} /> Juegos</Link>
        <header className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}>
            <Trophy size={28} style={{ color: "var(--color-primary)" }} />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>Liga de Iglesias</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{rangoSemana(tabla.semana)} · se reinicia cada lunes</p>
          <p className="text-xs max-w-sm" style={{ color: "var(--color-text-muted)" }}>{TEXTO_PARA_TODOS} <Link href="/reglas" className="underline" style={{ color: "var(--color-primary)" }}>Reglas</Link></p>
        </header>

        <TablaLiga inicial={tabla} />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Campeones de semanas anteriores</h2>
          {historial.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>El primer campeón se anuncia el próximo lunes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {historial.map((c) => (
                <li key={c.semana} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <span>🏆</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>{c.nombre}</span>
                    <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{rangoSemana(c.semana)}</span>
                  </span>
                  <span className="text-right text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                    <strong style={{ color: "var(--color-text)" }}>{c.puntos} pts</strong>
                    <br />
                    {c.jugadores} {c.jugadores === 1 ? "jugador" : "jugadores"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `TarjetaLigaHub.tsx`**

```tsx
// src/components/juegos/liga/TarjetaLigaHub.tsx
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import type { FilaLiga, MiIglesiaLiga } from "@/lib/liga/consultas.server";
import { enFrase } from "@/lib/liga/nombre";

export function TarjetaLigaHub({ mia, lider }: { mia: MiIglesiaLiga | null; lider: FilaLiga | null }) {
  const linea =
    mia?.aprobada && mia.lugar
      ? `${enFrase(mia.nombre, mia.comunidad, true)}${mia.campeona ? " 🏆" : ""} va en el lugar #${mia.lugar}`
      : lider
        ? `Va ganando ${enFrase(lider.nombre, lider.comunidad)}. ¿Y tu equipo?`
        : "Todos son bienvenidos: suma puntos para tu equipo";
  return (
    <div className="relative flex items-center gap-4 p-5 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(212,160,23,0.16) 0%, var(--color-surface) 65%)", border: "1px solid rgba(212,160,23,0.5)" }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}>
        <Trophy size={20} style={{ color: "var(--color-primary)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
          <Link href="/juegos/liga" className="after:absolute after:inset-0 after:rounded-2xl">Liga de Iglesias</Link>
        </h2>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{linea}</p>
      </div>
      <ChevronRight size={18} style={{ color: "var(--color-primary)" }} />
    </div>
  );
}
```

- [ ] **Step 5: /juegos.** En `juegos/page.tsx`:
  - importar `getTablaLiga` y `TarjetaLigaHub`;
  - agregar `getTablaLiga(profile?.id ?? null)` al final del `Promise.all` y nombrarlo `tablaLiga`;
  - después de `<JuegosPresence … />`:

```tsx
          <TarjetaLigaHub mia={tablaLiga.mia} lider={tablaLiga.top[0] ?? null} />
```

- [ ] **Step 6: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/components/juegos/liga "src/app/(public)/juegos/liga" "src/app/(public)/juegos/page.tsx"
git commit -m "Liga: página /juegos/liga y tarjeta en /juegos"
```

---

### Task 11: Aviso para jugadores sin sesión

**Files:**
- Create: `src/components/juegos/liga/InvitacionLiga.tsx`
- Modify: `src/components/juegos/palabra/PalabraGame.tsx`

- [ ] **Step 1: Componente**

```tsx
// src/components/juegos/liga/InvitacionLiga.tsx
// Al terminar una partida SIN sesión. Solo invita; no bloquea el juego.
import Link from "next/link";
import { LogIn } from "lucide-react";

export function InvitacionLiga({ returnUrl }: { returnUrl: string }) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl text-center sm:text-left" style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.3)" }}>
      <p className="flex-1 text-sm" style={{ color: "var(--color-text)" }}>¿Quieres que tus puntos sumen para la Iglesia de tu ciudad? Entra a tu cuenta</p>
      <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
        <LogIn size={16} /> Iniciar sesión
      </Link>
    </div>
  );
}
```

(El texto es el que pidió el usuario, tal cual.)

- [ ] **Step 2:** En `PalabraGame.tsx`, importar `InvitacionLiga` y, debajo de `{!conSesion && !partida.terminada && <InvitacionSesion />}`:

```tsx
      {!conSesion && partida.terminada && revelandoFila === null && <InvitacionLiga returnUrl="/juegos/palabra" />}
```

- [ ] **Step 3: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/components/juegos/liga/InvitacionLiga.tsx src/components/juegos/palabra/PalabraGame.tsx
git commit -m "Liga: invitar a entrar a la cuenta al terminar sin sesión"
```

---

### Task 12: Cambiar de equipo en /perfil y ranking de Palabra con la tabla nueva

**Files:**
- Create: `src/components/juegos/liga/CambiarIglesia.tsx`
- Modify: `src/app/(public)/perfil/page.tsx`, `src/lib/palabra/puntos.server.ts`, `src/app/(public)/juegos/palabra/page.tsx`, `src/components/juegos/palabra/PalabraRanking.tsx`

- [ ] **Step 1: `CambiarIglesia.tsx`**

```tsx
// src/components/juegos/liga/CambiarIglesia.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SelectorIglesia } from "./SelectorIglesia";

export function CambiarIglesia({ nombre, aprobada, puedeElegir }: { nombre: string | null; aprobada: boolean; puedeElegir: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  if (abierto) {
    return (
      <div className="flex flex-col gap-3">
        <SelectorIglesia onElegida={() => { setAbierto(false); router.refresh(); }} />
        <button type="button" onClick={() => setAbierto(false)} className="text-sm underline min-h-11" style={{ color: "var(--color-text-muted)" }}>Cancelar</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <p className="flex-1 text-sm" style={{ color: "var(--color-text)" }}>
        {nombre ? <>{nombre}{!aprobada && <span style={{ color: "var(--color-text-muted)" }}> · esperando aprobación</span>}</> : <span style={{ color: "var(--color-text-muted)" }}>Todavía no eliges tu equipo</span>}
      </p>
      {puedeElegir && (
        <button type="button" onClick={() => setAbierto(true)} className="px-3 py-2 rounded-lg text-sm font-semibold min-h-11" style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-primary)" }}>
          {nombre ? "Cambiar" : "Elegir"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: /perfil.** En `perfil/page.tsx`:
  - importar `getMiIglesia`, `CambiarIglesia`, `LIGA_DIAS_CAMBIO` y `aceptoVersionActual`;
  - después de cargar el perfil `p`, agregar `const liga = await getMiIglesia(p.id as string);`;
  - donde estaba el bloque de TikTok (quitado en la Task 5):

```tsx
        {/* ── LIGA DE IGLESIAS ─────────────────────────────────────── */}
        <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Mi equipo en la Liga</h2>
          <CambiarIglesia
            nombre={liga.iglesia?.nombre ?? null}
            aprobada={liga.iglesia?.aprobada ?? false}
            puedeElegir={aceptoVersionActual((p as { acepto_reglas_version?: string | null }).acepto_reglas_version)}
          />
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Puedes cambiarlo una vez cada {LIGA_DIAS_CAMBIO} días (salir de Amigos de Elim siempre se puede). Para elegir, primero acepta las reglas en cualquier juego.</p>
        </div>
```

- [ ] **Step 3: Ranking de Palabra con `iglesia_id`.** En `src/lib/palabra/puntos.server.ts`, función `perfiles` (el select ya trae `iglesia_id` desde la Task 5). Antes del `for`:

```ts
  const { data: igl } = await service.from("iglesias").select(COLUMNAS_IGLESIA).eq("aprobada", true);
  const aprob = (igl ?? []) as IglesiaBase[];
  const nombrePorId = new Map(aprob.map((i) => [i.id, nombreIglesia(i, aprob)]));
```

Dentro del `for`, la línea de `iglesia` pasa a ser `iglesia: nombrePorId.get(p.iglesia_id as string) ?? null,`. Importar `COLUMNAS_IGLESIA, nombreIglesia, type IglesiaBase` de `@/lib/liga/nombre`.

- [ ] **Step 4: Prop `usuario` de Palabra.** En `juegos/palabra/page.tsx`:
  - importar `getMiIglesia`;
  - `const liga = profile ? await getMiIglesia(profile.id as string) : null;`;
  - la prop pasa a `usuario={profile ? { iglesia: liga?.iglesia?.aprobada ? liga.iglesia.nombre : "" } : null}`.

  (`""` en vez de `null`, para que PalabraRanking no abra el formulario viejo de texto libre.)

- [ ] **Step 5: PalabraRanking sin texto libre.** En `PalabraRanking.tsx`:
  - quitar el import de `PreguntaIglesia`;
  - quitar la variable `preguntarIglesia`, la rama que muestra `<PreguntaIglesia … />` y los estados `editando`/`setEditando` si quedan sin uso;
  - el pie "Tu iglesia o ciudad: … cambiar" pasa a:

```tsx
                {usuario && (
                  <p className="text-[11px] text-center pt-3" style={{ color: "var(--color-text-muted)" }}>
                    Tu equipo: <strong>{iglesia || "sin elegir"}</strong> ·{" "}
                    <a href="/juegos/liga" className="underline" style={{ color: "var(--color-primary)" }}>{iglesia ? "ver la Liga" : "elegir mi equipo"}</a>
                  </p>
                )}
```

  Cambiar la nota de la pestaña a ``nota(`${rango} · puntos sumados por equipo`)``. `PreguntaIglesia.tsx` y `/api/juegos/palabra/iglesia` quedan sin uso y **no se borran**.

- [ ] **Step 6: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/components/juegos/liga/CambiarIglesia.tsx "src/app/(public)/perfil/page.tsx" src/lib/palabra/puntos.server.ts "src/app/(public)/juegos/palabra/page.tsx" src/components/juegos/palabra/PalabraRanking.tsx
git commit -m "Liga: cambiar de equipo en el perfil y ranking de Palabra con equipos"
```

---

### Task 13: Página /reglas

**Files:**
- Create: `src/app/(public)/reglas/page.tsx`
- Modify: `src/components/layout/PublicFooter.tsx`, `src/app/(public)/juegos/page.tsx`

- [ ] **Step 1: Página**

```tsx
// src/app/(public)/reglas/page.tsx
// Reglas de los juegos y de la Liga. Las cifras salen de src/lib/liga/config.ts
// para que esta página nunca diga algo distinto a lo que hace el sitio.
import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { TEXTO_PARA_TODOS, TEXTO_REGLA_PARTICIPACION } from "@/lib/reglas";
import { DENOMINACIONES, LIGA_DIAS_CAMBIO, LIGA_MAX_POR_PARTIDA, LIGA_PUNTOS, LIGA_TOPE_DIARIO } from "@/lib/liga/config";
import { NOMBRE_AMIGOS } from "@/lib/liga/nombre";

export const metadata: Metadata = {
  title: "Reglas de los juegos — Elim LLDM",
  description: "Reglas de los juegos y de la Liga de Iglesias de Elim LLDM. Todos son bienvenidos.",
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 flex flex-col gap-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <h2 className="text-base font-bold" style={{ color: "var(--color-text)" }}>{titulo}</h2>
      <div className="text-sm flex flex-col gap-2" style={{ color: "var(--color-text-muted)" }}>{children}</div>
    </section>
  );
}

export default function ReglasPage() {
  const p = LIGA_PUNTOS;
  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-xl mx-auto px-4 py-10 flex flex-col gap-5">
        <header className="flex flex-col items-center text-center gap-3">
          <ScrollText size={32} style={{ color: "var(--color-primary)" }} />
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>Reglas de los juegos</h1>
          <p className="text-base font-semibold" style={{ color: "var(--color-primary)" }}>{TEXTO_PARA_TODOS}</p>
        </header>

        <Seccion titulo="Tu nombre y tu foto">
          <p>{TEXTO_REGLA_PARTICIPACION}</p>
          <p>Tu nombre para mostrar lo eliges tú en tu perfil: puede ser tu nombre o un apodo, por ejemplo &quot;Hermano Juan GDL&quot;.</p>
        </Seccion>

        <Seccion titulo="Los equipos de la Liga">
          <p><strong>Iglesia de [Ciudad]</strong>: para los miembros de la Iglesia La Luz del Mundo, según la ciudad de su iglesia.</p>
          <p><strong>[Denominación] · [Ciudad]</strong>: para hermanos de otras iglesias ({DENOMINACIONES.join(", ")}).</p>
          <p><strong>{NOMBRE_AMIGOS}</strong>: para quien no pertenece a ninguna iglesia o prefiere no decir.</p>
          <p>Todos compiten en la misma Liga y con las mismas reglas.</p>
        </Seccion>

        <Seccion titulo="Cómo se ganan puntos">
          <p>Palabra del Día resuelta: {p.palabraBase} puntos, más {p.palabraPorIntentoSobrante} por cada intento que te sobró.</p>
          <p>Trivia en línea: {p.triviaPorCorrecta} punto por respuesta correcta (máximo {LIGA_MAX_POR_PARTIDA.trivia} por partida).</p>
          <p>La Ruleta en línea: {p.ruletaPorLetra} punto por letra acertada y {p.ruletaPorResolver} por resolver la frase (máximo {LIGA_MAX_POR_PARTIDA.ruleta} por partida).</p>
          <p>Ahorcado: {p.ahorcadoPorPalabra} puntos por palabra ganada.</p>
          <p>Máximo {LIGA_TOPE_DIARIO} puntos por juego al día para cada jugador.</p>
          <p>Las partidas sin iniciar sesión no suman puntos.</p>
        </Seccion>

        <Seccion titulo="La semana y el campeón">
          <p>La semana va de lunes a domingo, hora del Pacífico. Cada lunes se anuncia el equipo campeón, que lleva una 🏆 durante la semana siguiente, y la tabla empieza de cero.</p>
        </Seccion>

        <Seccion titulo="Elegir y cambiar de equipo">
          <p>Eliges tu equipo una vez y puedes cambiarlo una vez cada {LIGA_DIAS_CAMBIO} días. Salir de {NOMBRE_AMIGOS} siempre se puede.</p>
          <p>Si tu iglesia no aparece, puedes agregarla. Queda pendiente hasta que la aprobemos, y tus puntos se guardan desde ya.</p>
        </Seccion>

        <Seccion titulo="Juego limpio">
          <p>Juega con una sola cuenta y sin trampas. Si vemos algo que no es justo, podemos quitar puntos, corregir equipos o juntar iglesias repetidas.</p>
        </Seccion>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Enlaces.**
  - En `PublicFooter.tsx`, agregar `{ href: "/reglas", label: "Reglas" },` antes de `{ href: "/privacidad", … }`.
  - En `juegos/page.tsx`, debajo del encabezado (`<p>Elige una puerta y entra directo — sin códigos</p>`), agregar `<Link href="/reglas" className="text-xs underline" style={{ color: "var(--color-primary)" }}>Reglas de los juegos</Link>`.

- [ ] **Step 3: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add "src/app/(public)/reglas" src/components/layout/PublicFooter.tsx "src/app/(public)/juegos/page.tsx"
git commit -m "Página /reglas: todos son bienvenidos, equipos, puntos y juego limpio"
```

---

### Task 14: Cron de cierre semanal

**Files:**
- Create: `src/app/api/cron/liga-cierre/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Ruta**

```ts
// src/app/api/cron/liga-cierre/route.ts
//
// Cron del lunes (vercel.json): 07:05 y 08:05 UTC = 00:05 del Pacífico con
// y sin horario de verano. Guarda el campeón de la semana pasada; si ya
// estaba guardado, no hace nada.
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { semanaActual } from "@/lib/liga/consultas.server";
import { sumarDias } from "@/lib/palabra/logica";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Falta CRON_SECRET" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const semana = sumarDias(semanaActual(), -7);
  const service = await createServiceClient();
  const { data, error } = await service.rpc("liga_cerrar_semana", { p_semana: semana });
  if (error) {
    console.error("[cron/liga-cierre]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log("[cron/liga-cierre]", semana, data ? "campeón guardado" : "sin cambios");
  return NextResponse.json({ semana, guardada: data === true });
}
```

- [ ] **Step 2: `vercel.json`.** Agregar al arreglo `crons`:

```json
    { "path": "/api/cron/liga-cierre", "schedule": "5 7 * * 1" },
    { "path": "/api/cron/liga-cierre", "schedule": "5 8 * * 1" }
```

- [ ] **Step 3: Verificar y commit**

Run: `npx tsc --noEmit` y `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"` → sin errores.

```bash
git add src/app/api/cron/liga-cierre vercel.json
git commit -m "Liga: cron del lunes que guarda el equipo campeón"
```

---

### Task 15: Admin: resumen, equipos pendientes y aprobados

**Files:**
- Create: `src/app/admin/liga/acciones.ts`, `src/app/admin/liga/page.tsx`
- Modify: `src/components/layout/AdminSidebar.tsx`

- [ ] **Step 1: `acciones.ts`**

```ts
// src/app/admin/liga/acciones.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { adminId } from "@/lib/videos/categorias.server";
import { claveIglesia, limpiar } from "@/lib/liga/nombre";
import { esDenominacion } from "@/lib/liga/config";

function volver(error?: string): never {
  revalidatePath("/admin/liga");
  revalidatePath("/juegos/liga");
  redirect(error ? `/admin/liga?error=${encodeURIComponent(error)}` : "/admin/liga");
}

async function soloAdmin() {
  if (!(await adminId())) volver("Solo un administrador puede hacer esto");
}

export async function aprobarIglesia(formData: FormData) {
  await soloAdmin();
  const service = await createServiceClient();
  const { error } = await service.from("iglesias").update({ aprobada: true }).eq("id", String(formData.get("id") ?? ""));
  volver(error?.message);
}

/** Rechazar una pendiente: sus jugadores quedan sin equipo (les vuelve a salir el aviso). */
export async function rechazarIglesia(formData: FormData) {
  await soloAdmin();
  const id = String(formData.get("id") ?? "");
  const service = await createServiceClient();
  const { error: e1 } = await service.from("profiles").update({ iglesia_id: null, iglesia_preguntada: false }).eq("iglesia_id", id);
  if (e1) volver(e1.message);
  const { error } = await service.from("iglesias").delete().eq("id", id).eq("aprobada", false).neq("comunidad", "amigos");
  volver(error?.message);
}

export async function juntarIglesias(formData: FormData) {
  await soloAdmin();
  const conservar = String(formData.get("conservar") ?? "");
  if (!conservar) volver("Elige con cuál equipo juntarlo");
  const service = await createServiceClient();
  const { error } = await service.rpc("liga_juntar_iglesias", { p_conservar: conservar, p_quitar: String(formData.get("id") ?? "") });
  volver(error?.message);
}

export async function editarIglesia(formData: FormData) {
  await soloAdmin();
  const id = String(formData.get("id") ?? "");
  const comunidad = String(formData.get("comunidad") ?? "");
  const ciudad = limpiar(String(formData.get("ciudad") ?? ""));
  const estado = limpiar(String(formData.get("estado") ?? ""));
  const pais = limpiar(String(formData.get("pais") ?? ""));
  const den = comunidad === "otra" ? String(formData.get("denominacion") ?? "") : null;
  if (comunidad !== "lldm" && comunidad !== "otra") volver("Este equipo no se edita");
  if (comunidad === "otra" && !esDenominacion(den)) volver("Elige una denominación de la lista");
  if (!ciudad || !estado || !pais) volver("Ciudad, estado y país son obligatorios");
  const service = await createServiceClient();
  const { error } = await service
    .from("iglesias")
    .update({ denominacion: den, ciudad, estado, pais, clave: claveIglesia(comunidad as "lldm" | "otra", den, ciudad, estado, pais) })
    .eq("id", id)
    .neq("comunidad", "amigos");
  volver(error ? (error.code === "23505" ? "Ya existe otro equipo igual" : error.message) : undefined);
}
```

- [ ] **Step 2: `page.tsx`**

```tsx
// src/app/admin/liga/page.tsx
// Liga de Iglesias (solo admin; admin/layout.tsx ya lo revisa).
import { Trophy } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { COLUMNAS_IGLESIA, NOMBRE_AMIGOS, detalleIglesia, nombreIglesia, normalizar, type IglesiaBase } from "@/lib/liga/nombre";
import { DENOMINACIONES } from "@/lib/liga/config";
import { getDatosTarjetaLiga, getResumenComunidades, getSemanasTarjeta, semanaActual } from "@/lib/liga/consultas.server";
import { rangoCorto } from "@/lib/juegos/campeones/semana";
import { TarjetaLiga } from "@/components/admin/liga/TarjetaLiga";
import { aprobarIglesia, editarIglesia, juntarIglesias, rechazarIglesia } from "./acciones";

export const metadata = { title: "Liga de Iglesias — Admin" };
export const dynamic = "force-dynamic";

type Fila = IglesiaBase & { aprobada: boolean; creada_por: string | null };

const boton = "px-3 py-2 rounded-lg text-xs font-semibold min-h-9";
const campo = { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" } as const;
const caja = { background: "var(--color-surface)", border: "1px solid var(--color-border)" } as const;

function Numero({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl p-3 flex flex-col" style={caja}>
      <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--color-text)" }}>{valor}</span>
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{etiqueta}</span>
    </div>
  );
}

export default async function AdminLigaPage({ searchParams }: { searchParams: Promise<{ error?: string; semana?: string }> }) {
  const { error, semana: pedida } = await searchParams;
  const service = await createServiceClient();
  const semana = semanaActual();

  const [{ data: igl }, { data: perf }, { data: pts }, semanas, resumen] = await Promise.all([
    service.from("iglesias").select(`${COLUMNAS_IGLESIA}, aprobada, creada_por`).order("ciudad"),
    service.from("profiles").select("id, iglesia_id, display_name").not("iglesia_id", "is", null),
    service.from("liga_puntos").select("iglesia_id, puntos").eq("semana", semana),
    getSemanasTarjeta(),
    getResumenComunidades(),
  ]);
  const todas = (igl ?? []) as Fila[];
  const aprobadas = todas.filter((i) => i.aprobada);
  const pendientes = todas.filter((i) => !i.aprobada);
  const jugadores = new Map<string, number>();
  const nombres = new Map<string, string>();
  for (const p of (perf ?? []) as Array<{ id: string; iglesia_id: string; display_name: string }>) {
    jugadores.set(p.iglesia_id, (jugadores.get(p.iglesia_id) ?? 0) + 1);
    nombres.set(p.id, p.display_name);
  }
  const puntos = new Map<string, number>();
  for (const r of (pts ?? []) as Array<{ iglesia_id: string | null; puntos: number }>) {
    if (r.iglesia_id) puntos.set(r.iglesia_id, (puntos.get(r.iglesia_id) ?? 0) + r.puntos);
  }
  const semanaTarjeta = pedida && semanas.includes(pedida) ? pedida : semanas[0];
  const datosTarjeta = await getDatosTarjetaLiga(semanaTarjeta);
  const editables = aprobadas.filter((i) => i.comunidad !== "amigos");
  const amigos = aprobadas.find((i) => i.comunidad === "amigos");
  const juntables = editables;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <Trophy size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>Liga de Iglesias</h1>
      </div>
      {error && <p className="text-sm p-3 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-destructive)" }}>{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Resumen de jugadores</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Numero etiqueta="Iglesia La Luz del Mundo" valor={resumen.lldm} />
          <Numero etiqueta="Otras denominaciones" valor={resumen.otras.reduce((s, o) => s + o.jugadores, 0)} />
          <Numero etiqueta={NOMBRE_AMIGOS} valor={resumen.amigos} />
          <Numero etiqueta="Todavía no eligen" valor={resumen.sinElegir} />
        </div>
        {resumen.otras.length > 0 && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{resumen.otras.map((o) => `${o.denominacion}: ${o.jugadores}`).join(" · ")}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Pendientes de aprobar ({pendientes.length})</h2>
        {pendientes.length === 0 && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No hay equipos pendientes.</p>}
        {pendientes.map((i) => {
          const parecidas = editables.filter((a) => a.comunidad === i.comunidad && a.denominacion === i.denominacion && normalizar(a.ciudad) === normalizar(i.ciudad));
          return (
            <div key={i.id} className="rounded-xl p-4 flex flex-col gap-3" style={caja}>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{i.comunidad === "lldm" ? "LLDM" : i.denominacion} · {detalleIglesia(i)}</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Propuesta por {i.creada_por ? (nombres.get(i.creada_por) ?? "un jugador") : "—"} · {jugadores.get(i.id) ?? 0} jugadores · {puntos.get(i.id) ?? 0} pts esta semana
                </p>
                {parecidas.length > 0 && <p className="text-xs mt-1" style={{ color: "var(--color-primary)" }}>Parecidas: {parecidas.map((a) => detalleIglesia(a)).join(" · ")}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={aprobarIglesia}><input type="hidden" name="id" value={i.id} /><button className={boton} style={{ background: "var(--color-primary)", color: "#000" }}>Aprobar</button></form>
                <form action={rechazarIglesia}><input type="hidden" name="id" value={i.id} /><button className={boton} style={{ ...campo, color: "var(--color-destructive)" }}>Rechazar</button></form>
                {juntables.length > 0 && (
                  <form action={juntarIglesias} className="flex gap-2">
                    <input type="hidden" name="id" value={i.id} />
                    <select name="conservar" defaultValue={parecidas[0]?.id ?? ""} className="px-2 rounded-lg text-xs" style={campo}>
                      <option value="">Juntar con…</option>
                      {juntables.map((a) => <option key={a.id} value={a.id}>{nombreIglesia(a, aprobadas)} ({a.estado}, {a.pais})</option>)}
                    </select>
                    <button className={boton} style={campo}>Juntar</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Aprobados ({aprobadas.length})</h2>
        {amigos && <p className="text-sm rounded-xl p-3" style={{ ...caja, color: "var(--color-text)" }}>{NOMBRE_AMIGOS} · <span style={{ color: "var(--color-text-muted)" }}>{jugadores.get(amigos.id) ?? 0} jugadores · {puntos.get(amigos.id) ?? 0} pts (no se edita)</span></p>}
        {editables.map((i) => (
          <details key={i.id} className="rounded-xl p-4" style={caja}>
            <summary className="text-sm cursor-pointer" style={{ color: "var(--color-text)" }}>
              {nombreIglesia(i, aprobadas)} · <span style={{ color: "var(--color-text-muted)" }}>{i.estado}, {i.pais} · {jugadores.get(i.id) ?? 0} jugadores · {puntos.get(i.id) ?? 0} pts</span>
            </summary>
            <form action={editarIglesia} className="flex flex-wrap gap-2 mt-3">
              <input type="hidden" name="id" value={i.id} />
              <input type="hidden" name="comunidad" value={i.comunidad} />
              {i.comunidad === "otra" && (
                <select name="denominacion" defaultValue={i.denominacion ?? ""} className="px-2 py-1.5 rounded-lg text-sm" style={campo}>
                  {DENOMINACIONES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <input name="ciudad" defaultValue={i.ciudad ?? ""} maxLength={60} className="px-2 py-1.5 rounded-lg text-sm" style={campo} />
              <input name="estado" defaultValue={i.estado ?? ""} maxLength={60} className="px-2 py-1.5 rounded-lg text-sm" style={campo} />
              <input name="pais" defaultValue={i.pais ?? ""} maxLength={60} className="px-2 py-1.5 rounded-lg text-sm" style={campo} />
              <button className={boton} style={{ background: "var(--color-primary)", color: "#000" }}>Guardar</button>
            </form>
          </details>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Generar tarjeta de la Liga</h2>
        <form method="get" className="flex items-end gap-2">
          <select name="semana" defaultValue={semanaTarjeta} className="px-3 py-2 rounded-lg text-sm" style={campo}>
            {semanas.map((s) => <option key={s} value={s}>{rangoCorto(s)}{s === semana ? " (en curso)" : ""}</option>)}
          </select>
          <button className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--color-primary)", color: "#000" }}>Ver</button>
        </form>
        <TarjetaLiga datos={datosTarjeta} />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Menú.** En `AdminSidebar.tsx`, importar `Church` de `lucide-react` y agregar después del item de Palabra del Día:

```ts
  { href: "/admin/liga", label: "Liga de Iglesias", icon: Church },
```

(El commit va junto con la Task 16, porque la página importa `TarjetaLiga`.)

---

### Task 16: Tarjeta 1080x1920 para TikTok

**Files:**
- Create: `src/components/admin/liga/TarjetaLiga.tsx`

- [ ] **Step 1: Componente**

```tsx
// src/components/admin/liga/TarjetaLiga.tsx
//
// Imagen vertical 1080x1920 de la Liga: título con la semana, los 3
// primeros equipos y el mejor jugador (nombre para mostrar y foto, o la
// inicial) SOLO si aceptó la regla. La foto se baja por
// /api/admin/palabra/tiktok/foto (mismo dominio) para que el lienzo no
// quede "sucio" por CORS y se pueda descargar el PNG.
"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { DatosTarjetaLiga } from "@/lib/liga/consultas.server";
import { rangoSemana } from "@/lib/juegos/campeones/semana";
import { fotoDesdeServidor } from "@/lib/palabra/video/recursos";

const ANCHO = 1080;
const ALTO = 1920;
const ORO = "#D4A017";
const FONDO = "#0A0A12";
const TEXTO = "#F8F8FF";
const GRIS = "#9090A8";
const MEDALLAS = ["🥇", "🥈", "🥉"];
const FUENTE = "Inter, system-ui, sans-serif";

function cargar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function ajustar(ctx: CanvasRenderingContext2D, texto: string, maxAncho: number, tamano: number) {
  let t = tamano;
  do {
    ctx.font = `700 ${t}px ${FUENTE}`;
    if (ctx.measureText(texto).width <= maxAncho) break;
    t -= 2;
  } while (t > 28);
}

async function dibujar(ctx: CanvasRenderingContext2D, d: DatosTarjetaLiga) {
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  const glow = ctx.createRadialGradient(ANCHO / 2, 520, 50, ANCHO / 2, 520, 900);
  glow.addColorStop(0, "rgba(212,160,23,0.28)");
  glow.addColorStop(1, "rgba(212,160,23,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.textAlign = "center";
  ctx.fillStyle = ORO;
  ctx.font = `700 56px ${FUENTE}`;
  ctx.fillText("ELIM LLDM", ANCHO / 2, 200);
  ctx.fillStyle = TEXTO;
  ctx.font = `800 104px ${FUENTE}`;
  ctx.fillText("Liga de Iglesias", ANCHO / 2, 340);
  ctx.fillStyle = GRIS;
  ctx.font = `500 44px ${FUENTE}`;
  ctx.fillText(`Semana: ${rangoSemana(d.semana)}`, ANCHO / 2, 420);

  let y = 560;
  if (d.top3.length === 0) {
    ctx.fillStyle = GRIS;
    ctx.font = `500 48px ${FUENTE}`;
    ctx.fillText("Todavía no hay puntos esta semana", ANCHO / 2, y + 120);
  }
  d.top3.forEach((f, i) => {
    const alto = 230;
    ctx.fillStyle = i === 0 ? "rgba(212,160,23,0.18)" : "rgba(255,255,255,0.05)";
    ctx.strokeStyle = i === 0 ? ORO : "rgba(255,255,255,0.12)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(90, y, ANCHO - 180, alto, 36);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "96px sans-serif";
    ctx.fillText(MEDALLAS[i], 130, y + 145);
    ctx.fillStyle = TEXTO;
    ajustar(ctx, f.nombre, ANCHO - 420, 60);
    ctx.fillText(f.nombre, 270, y + 110);
    ctx.fillStyle = ORO;
    ctx.font = `700 52px ${FUENTE}`;
    ctx.fillText(`${f.puntos} puntos`, 270, y + 180);
    ctx.textAlign = "center";
    y += alto + 40;
  });

  if (d.mejor) {
    y = Math.max(y + 40, 1420);
    ctx.fillStyle = GRIS;
    ctx.font = `600 42px ${FUENTE}`;
    ctx.fillText("Mejor jugador de la semana", ANCHO / 2, y);
    const foto = d.mejor.avatar ? await cargar(fotoDesdeServidor(d.mejor.avatar)) : null;
    const cx = ANCHO / 2;
    const cy = y + 130;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (foto) {
      ctx.drawImage(foto, cx - 90, cy - 90, 180, 180);
    } else {
      ctx.fillStyle = "#1C1C2E";
      ctx.fillRect(cx - 90, cy - 90, 180, 180);
      ctx.fillStyle = ORO;
      ctx.font = `700 90px ${FUENTE}`;
      ctx.fillText(d.mejor.nombre.charAt(0).toUpperCase(), cx, cy + 32);
    }
    ctx.restore();
    ctx.fillStyle = TEXTO;
    ajustar(ctx, d.mejor.nombre, ANCHO - 160, 56);
    ctx.fillText(d.mejor.nombre, cx, cy + 170);
    ctx.fillStyle = GRIS;
    ctx.font = `500 40px ${FUENTE}`;
    ctx.fillText(`${d.mejor.puntos} puntos${d.mejor.equipo ? ` · ${d.mejor.equipo}` : ""}`, cx, cy + 230);
  }

  ctx.fillStyle = ORO;
  ctx.font = `600 44px ${FUENTE}`;
  ctx.fillText("Todos son bienvenidos · elimlldm.net/juegos/liga", ANCHO / 2, ALTO - 120);
}

export function TarjetaLiga({ datos }: { datos: DatosTarjetaLiga }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const ctx = lienzo.current?.getContext("2d");
    if (!ctx) return;
    setListo(false);
    void dibujar(ctx, datos).then(() => setListo(true));
  }, [datos]);

  function descargar() {
    lienzo.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `liga-iglesias-${datos.semana}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  }

  return (
    <div className="flex flex-col gap-3 items-start">
      <canvas ref={lienzo} width={ANCHO} height={ALTO} className="w-full max-w-[360px] rounded-xl" style={{ border: "1px solid var(--color-border)" }} />
      {!datos.mejor && <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>El mejor jugador no sale porque no ha aceptado la regla de participación (o nadie ha jugado).</p>}
      <button type="button" disabled={!listo} onClick={descargar} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold disabled:opacity-60" style={{ background: "var(--color-primary)", color: "#000" }}>
        <Download size={16} /> Descargar imagen (PNG)
      </button>
    </div>
  );
}
```

(`fotoDesdeServidor` está exportado en `src/lib/palabra/video/recursos.ts:32` y ese archivo no es `server-only`. Si el build se queja por lo que arrastra al cliente, copiar esa línea dentro de este componente.)

- [ ] **Step 2: Verificar y commit (Tasks 15 y 16)**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/app/admin/liga src/components/admin/liga src/components/layout/AdminSidebar.tsx
git commit -m "Liga: admin con resumen por comunidad, equipos y tarjeta para TikTok"
```

---

### Task 17: Build, migración y prueba completa

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: termina sin errores.

- [ ] **Step 2: Pedir autorización al usuario** para aplicar `0086_liga_iglesias.sql` en el SQL Editor de Supabase. Con su "sí", aplicarla con Claude en Chrome usando su sesión.

- [ ] **Step 3: Revisar la base** con la REST API (service role de `.env.local`):
  - `iglesias` tiene 5 filas aprobadas: "Amigos de Elim" y 4 LLDM.
  - Los 4 perfiles de texto libre tienen `iglesia_id`.
  - Con la anon key, `GET /rest/v1/liga_puntos` es rechazado.
  - Con la anon key y un token de usuario, `PATCH /rest/v1/profiles` de `acepto_reglas_version` o `iglesia_id` falla (trigger).
  - Un `INSERT` de `iglesias` con `comunidad='otra'` y `denominacion='Inventada'` falla (CHECK).

- [ ] **Step 4: Probar en local** (`npm run dev` en el puerto 3100, que usa la base de producción), con la cuenta del usuario en Chrome:
  1. Entrar a /juegos/palabra: sale la pantalla de reglas con su nombre. "Ahora no" deja la barra de abajo; intentar jugar responde "Acepta las reglas de los juegos para jugar".
  2. Aceptar (con un apodo de prueba y luego volver a su nombre real): sale "En Elim LLDM todos son bienvenidos. ¿De qué iglesia eres?".
  3. Probar las 4 opciones del selector:
     - **LLDM:** "Guadalajara" aparece.
     - **Otra iglesia:** Bautista, agregar "Las Vegas" (queda pendiente).
     - **Amigos de Elim:** entra directo.
     - **Cambio:** salir de Amigos de Elim a una LLDM está permitido; un segundo cambio inmediato responde que debe esperar 30 días.
  4. /juegos/liga: cabecera con `enFrase`, botón de invitar y tabla.
  5. Con un script temporal en el scratchpad (service role):
     - registrar 3 veces el mismo `eventoRef` deja 1 fila;
     - 50 puntos de ahorcado en eventos distintos dejan 40 en el día.
  6. `GET /api/cron/liga-cierre` con `Authorization: Bearer $CRON_SECRET` responde `{ semana, guardada }`; la segunda vez, `guardada: false`.
  7. /admin/liga:
     - el resumen cuenta LLDM, Bautista y Amigos;
     - aprobar y rechazar funcionan;
     - la tarjeta se dibuja y se descarga.
  8. /reglas muestra "Elim LLDM es para todos…" y las cifras de la config.
  9. /login en modo registro muestra el nombre para mostrar y "Acepto" sin marcar (no crear cuenta).
  10. Volver a jugar un momento cada uno de los 4 juegos: funcionan igual y ya no sale la casilla de TikTok.
  11. Con la sesión cerrada, al terminar Palabra del Día sale "¿Quieres que tus puntos sumen…".
  12. Borrar las filas de prueba de `liga_puntos`, `liga_campeonas` e `iglesias` (la Bautista de prueba), y regresar el perfil del usuario a como estaba: sin equipo, `iglesia_preguntada = false`, con la aceptación hecha.

- [ ] **Step 5: Avisar al usuario** del resultado y preguntar si se pasa a master y se publica.

---

## Self-review

- **Cobertura del diseño:**
  - §1 Equipos (comunidad, denominación, Amigos): Tasks 1, 2, 8 y 15.
  - §2 Elegir (pregunta LLDM, denominación, ciudad, Amigos, 30 días, salir de Amigos): Tasks 8, 9 y 12.
  - §3 Puntos: Tasks 1, 2 y 6.
  - §4 Sin sesión: Task 11.
  - §5 Página: Task 10.
  - §6 Cron: Task 14.
  - §7 Admin con resumen: Tasks 15 y 16.
  - §8 Regla general:
    - registro: Task 4;
    - pantalla y barra: Tasks 4 y 9;
    - exigida por el servidor: Tasks 3 y 8;
    - nombre para mostrar: Tasks 3 y 4;
    - casilla quitada: Task 5;
    - /reglas: Task 13.
  - §9 Migración: Tasks 1 y 17.
  - §11 Pruebas: Task 17.
- **Tipos coherentes:** `Comunidad`, `IglesiaBase`, `COLUMNAS_IGLESIA`, `IglesiaElegida`, `TablaLiga` (con `aceptoReglas`), `MiIglesiaLiga.siguiente` como objeto `{ nombre, comunidad }`, `DatosTarjetaLiga.mejor.equipo` y `PerfilAvisos`. Se usan con los mismos nombres en todas las tareas.
- **Texto fijo pedido por el usuario:** la regla, la nota del nombre, "Elim LLDM es para todos…", "En Elim LLDM todos son bienvenidos. ¿De qué iglesia eres?" y "¿Quieres que tus puntos sumen para la Iglesia de tu ciudad? Entra a tu cuenta". Están en `src/lib/reglas.ts` o en el componente, tal cual.
