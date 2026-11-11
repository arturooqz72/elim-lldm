# Liga de Iglesias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los puntos de Palabra del Día, Trivia en línea, La Ruleta en línea y Ahorcado sumen para la "Iglesia de [Ciudad]" de cada jugador, con tabla semanal en /juegos/liga, campeona semanal por cron y tarjeta para TikTok en /admin/liga.

**Architecture:** Un registro central `liga_puntos` que solo escribe el servidor mediante la función SQL `liga_registrar_puntos` (topes y bloqueo por jugador dentro de la base). Cada juego llama `registrarPuntosLiga()` con `after()` desde el punto donde ya valida el resultado, así un fallo de la Liga nunca rompe el juego. Las lecturas (tabla, jugadores, campeonas) salen de funciones SQL ejecutadas con service role y se arman en `src/lib/liga/consultas.server.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase (Postgres, RLS, service role), Vercel Cron, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-11-11-liga-de-iglesias-design.md`

**Verificación en este repo:** no hay test runner. Cada tarea termina con `npx tsc --noEmit`, que debe salir sin errores. Al final van `npm run build` y una prueba en el navegador.

**Reglas del usuario:** nunca usar `rm` (archivos que ya no se usan se dejan); `.env.example` nunca se versiona; preguntar antes de aplicar SQL en producción y antes de subir a master.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0086_liga_iglesias.sql` | Tablas, columnas, RLS, trigger, funciones, alta de 4 iglesias |
| `src/lib/liga/config.ts` | Reglas de puntos y constantes (cliente y servidor) |
| `src/lib/liga/nombre.ts` | Normalizar texto, clave única y "Iglesia de [Ciudad]" |
| `src/lib/liga/registrar.server.ts` | `registrarPuntosLiga()` (llama a la función SQL, nunca lanza) |
| `src/lib/liga/consultas.server.ts` | Tabla de la semana, mi iglesia, jugadores, campeonas, datos de la tarjeta |
| `src/app/api/liga/iglesias/route.ts` | Buscar iglesias aprobadas |
| `src/app/api/liga/mi-iglesia/route.ts` | Elegir o agregar iglesia (regla de 30 días, duplicados) |
| `src/app/api/liga/no-preguntar/route.ts` | "Ahora no" del aviso |
| `src/app/api/liga/tabla/route.ts` | Tabla para la actualización cada 30 s |
| `src/app/api/cron/liga-cierre/route.ts` | Cierre semanal |
| `src/components/juegos/liga/SelectorIglesia.tsx` | Buscador y formulario para agregar |
| `src/components/juegos/liga/AvisoIglesia.tsx` | Modal "¿De qué ciudad es tu iglesia?" |
| `src/components/juegos/liga/AvisoIglesiaLiga.tsx` | Decide en el servidor si se muestra el modal |
| `src/components/juegos/liga/InvitarHermanos.tsx` | Compartir (menú nativo y WhatsApp) |
| `src/components/juegos/liga/TablaLiga.tsx` | Mi iglesia, top 10 y jugadores, con actualización cada 30 s |
| `src/components/juegos/liga/InvitacionLiga.tsx` | Aviso para jugadores sin sesión |
| `src/components/juegos/liga/TarjetaLigaHub.tsx` | Tarjeta en /juegos |
| `src/components/juegos/liga/CambiarIglesia.tsx` | Cambiar iglesia en /perfil |
| `src/app/(public)/juegos/liga/page.tsx` | Página de la Liga |
| `src/app/admin/liga/page.tsx` y `acciones.ts` | Iglesias pendientes y aprobadas, y tarjeta |
| `src/components/admin/liga/TarjetaLiga.tsx` | Imagen 1080x1920 en canvas |

---

### Task 1: Migración 0086

**Files:**
- Create: `supabase/migrations/0086_liga_iglesias.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- ============================================================
-- Elim LLDM — Liga de Iglesias (/juegos/liga)
--
-- Cada jugador pertenece a la "Iglesia de [Ciudad]" y los puntos que gana
-- en Palabra del Día, Trivia en línea, La Ruleta en línea y Ahorcado
-- suman para su iglesia. Diseño:
-- docs/superpowers/specs/2026-11-11-liga-de-iglesias-design.md
--
-- 1. iglesias: lectura pública solo de las aprobadas. Altas, aprobación,
--    rechazo y fusión solo desde el servidor (service role).
-- 2. profiles.iglesia_id / iglesia_cambiada_en / iglesia_preguntada: no
--    entran al GRANT de SELECT por columnas (0076) y un trigger impide
--    cambiarlas desde el navegador (mismo patrón que 0069): así nadie se
--    salta la regla de 30 días ni se pone una iglesia por REST.
-- 3. liga_puntos: sin ningún permiso para anon/authenticated. Solo la
--    escribe liga_registrar_puntos (topes por partida y por día, bloqueo
--    por jugador) llamada por el servidor.
-- 4. liga_campeonas: una fila por semana cerrada (cron del lunes).
--
-- profiles.iglesia (texto libre de 0054) se deja sin borrar.
-- ============================================================

-- ---------- iglesias ----------
CREATE TABLE iglesias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ciudad TEXT NOT NULL CHECK (char_length(btrim(ciudad)) BETWEEN 1 AND 60),
  estado TEXT NOT NULL CHECK (char_length(btrim(estado)) BETWEEN 1 AND 60),
  pais TEXT NOT NULL CHECK (char_length(btrim(pais)) BETWEEN 1 AND 60),
  -- normalizar(ciudad)|normalizar(estado)|normalizar(pais), calculada en
  -- src/lib/liga/nombre.ts. Evita "Las Vegas" y "las vegas" duplicadas.
  clave TEXT NOT NULL UNIQUE,
  aprobada BOOLEAN NOT NULL DEFAULT FALSE,
  creada_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_iglesias_pendientes ON iglesias (creada_en) WHERE NOT aprobada;

ALTER TABLE iglesias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iglesias_select_aprobadas" ON iglesias FOR SELECT USING (aprobada);
REVOKE ALL ON iglesias FROM anon, authenticated;
GRANT SELECT ON iglesias TO anon, authenticated;


-- ---------- profiles ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS iglesia_id UUID REFERENCES iglesias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS iglesia_cambiada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS iglesia_preguntada BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_iglesia_id ON profiles (iglesia_id) WHERE iglesia_id IS NOT NULL;

CREATE OR REPLACE FUNCTION profiles_proteger_liga()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.iglesia_id IS DISTINCT FROM OLD.iglesia_id
      OR NEW.iglesia_cambiada_en IS DISTINCT FROM OLD.iglesia_cambiada_en
      OR NEW.iglesia_preguntada IS DISTINCT FROM OLD.iglesia_preguntada)
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin')
  THEN
    RAISE EXCEPTION 'La iglesia de la Liga solo se cambia desde el sitio'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_proteger_liga_trg ON profiles;
CREATE TRIGGER profiles_proteger_liga_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_proteger_liga();


-- ---------- liga_puntos ----------
CREATE TABLE liga_puntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jugador UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- La iglesia del jugador cuando ganó los puntos; NULL si no tenía.
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

-- Lunes de la semana actual en hora del Pacífico.
CREATE OR REPLACE FUNCTION liga_semana_actual()
RETURNS DATE
LANGUAGE sql STABLE
AS $$
  SELECT date_trunc('week', (now() AT TIME ZONE 'America/Los_Angeles')::date)::date;
$$;

-- Registra puntos con topes. Devuelve los puntos que de verdad se guardaron.
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

  -- Dos peticiones del mismo jugador a la vez no se pasan del tope.
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

-- Iglesias aprobadas con puntos en una semana, de mayor a menor.
-- Empate: más jugadores y luego quien llegó primero a ese total.
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

-- Jugadores con más puntos en la semana; p_iglesia NULL = de todas.
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

-- Guarda la campeona de una semana. Idempotente: el cron corre dos veces.
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

-- Al elegir iglesia por primera vez, sus puntos sin iglesia de esta semana pasan a ella.
CREATE OR REPLACE FUNCTION liga_asignar_sin_iglesia(p_jugador UUID, p_iglesia UUID)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE liga_puntos SET iglesia_id = p_iglesia
  WHERE jugador = p_jugador AND iglesia_id IS NULL AND semana = liga_semana_actual();
$$;

-- Junta una iglesia duplicada con la que se conserva (jugadores, puntos y campeonatos).
CREATE OR REPLACE FUNCTION liga_juntar_iglesias(p_conservar UUID, p_quitar UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_conservar = p_quitar THEN
    RAISE EXCEPTION 'Elige dos iglesias distintas';
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


-- ---------- iglesias que ya existían en texto libre ----------
INSERT INTO iglesias (ciudad, estado, pais, clave, aprobada) VALUES
  ('Riverside', 'California', 'Estados Unidos', 'riverside|california|estados unidos', TRUE),
  ('Guadalajara', 'Jalisco', 'México', 'guadalajara|jalisco|mexico', TRUE),
  ('Santa Lucía', 'Campeche', 'México', 'santa lucia|campeche|mexico', TRUE),
  ('Ciudad de México', 'CDMX', 'México', 'ciudad de mexico|cdmx|mexico', TRUE)
ON CONFLICT (clave) DO NOTHING;

UPDATE profiles p
SET iglesia_id = i.id, iglesia_preguntada = TRUE
FROM iglesias i
WHERE (btrim(p.iglesia) = 'Riverside' AND i.clave = 'riverside|california|estados unidos')
   OR (btrim(p.iglesia) = 'Guadalajara' AND i.clave = 'guadalajara|jalisco|mexico')
   OR (btrim(p.iglesia) = 'Santa Lucia, Campeche' AND i.clave = 'santa lucia|campeche|mexico')
   OR (btrim(p.iglesia) = 'Cdmx, Magdalena' AND i.clave = 'ciudad de mexico|cdmx|mexico');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0086_liga_iglesias.sql
git commit -m "Liga de Iglesias: migración 0086"
```

(Se aplica en Supabase en la Task 14, con autorización del usuario.)

---

### Task 2: Biblioteca `src/lib/liga`

**Files:**
- Create: `src/lib/liga/config.ts`, `src/lib/liga/nombre.ts`, `src/lib/liga/registrar.server.ts`

- [ ] **Step 1: `config.ts`**

```ts
// src/lib/liga/config.ts
//
// Reglas de puntos de la Liga de Iglesias. Cambiar aquí cambia la Liga
// entera: la base solo aplica los topes que se le pasan desde aquí.
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

/** Máximo por jugador, por juego, por día (hora del Pacífico). */
export const LIGA_TOPE_DIARIO = 40;

/** Días que deben pasar para cambiar de iglesia. */
export const LIGA_DIAS_CAMBIO = 30;

/** Cada cuánto se actualiza la tabla de /juegos/liga. */
export const LIGA_REFRESCO_MS = 30_000;

export const LIGA_URL = "https://www.elimlldm.net/juegos/liga";

/** Palabra del Día resuelta: 10 + 2 por cada intento que sobró. */
export function puntosPalabraLiga(numIntentos: number): number {
  const sobrantes = Math.max(0, PALABRA_MAX_INTENTOS - numIntentos);
  return LIGA_PUNTOS.palabraBase + LIGA_PUNTOS.palabraPorIntentoSobrante * sobrantes;
}

export function textoInvitacion(nombreIglesia: string | null): string {
  return nombreIglesia
    ? `Ayuda a la ${nombreIglesia} a ganar la Liga de Elim LLDM 🏆 juega aquí: ${LIGA_URL}`
    : `Juega en la Liga de Iglesias de Elim LLDM 🏆 y suma puntos para la iglesia de tu ciudad: ${LIGA_URL}`;
}
```

- [ ] **Step 2: `nombre.ts`**

```ts
// src/lib/liga/nombre.ts
//
// El nombre que se muestra siempre es "Iglesia de " + ciudad. Si otra
// iglesia aprobada tiene la misma ciudad, se agrega el estado; si también
// coincide el estado, el país. Nunca se dice "congregación".

export interface IglesiaBase {
  id: string;
  ciudad: string;
  estado: string;
  pais: string;
}

/** Minúsculas, sin acentos, solo letras/números/espacios, espacios colapsados. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quita espacios de más, para guardar como lo escribió. */
export function limpiar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** Debe dar lo mismo que las claves escritas a mano en 0086. */
export function claveIglesia(ciudad: string, estado: string, pais: string): string {
  return [ciudad, estado, pais].map(normalizar).join("|");
}

/** `aprobadas` = todas las iglesias aprobadas (para saber si hay ciudades repetidas). */
export function nombreIglesia(iglesia: IglesiaBase, aprobadas: IglesiaBase[]): string {
  const ciudad = normalizar(iglesia.ciudad);
  const otras = aprobadas.filter((o) => o.id !== iglesia.id && normalizar(o.ciudad) === ciudad);
  if (otras.length === 0) return `Iglesia de ${iglesia.ciudad}`;
  const mismoEstado = otras.some((o) => normalizar(o.estado) === normalizar(iglesia.estado));
  return mismoEstado
    ? `Iglesia de ${iglesia.ciudad}, ${iglesia.estado}, ${iglesia.pais}`
    : `Iglesia de ${iglesia.ciudad}, ${iglesia.estado}`;
}

export function detalleIglesia(iglesia: IglesiaBase): string {
  return `${iglesia.ciudad}, ${iglesia.estado}, ${iglesia.pais}`;
}
```

- [ ] **Step 3: `registrar.server.ts`**

```ts
// src/lib/liga/registrar.server.ts
//
// Único punto por donde entran puntos a la Liga. Lo llaman las rutas de
// cada juego DESPUÉS de validar el resultado en el servidor, envuelto en
// after() para no retrasar la respuesta. Nunca lanza: si la Liga falla,
// el juego sigue igual.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { LIGA_MAX_POR_PARTIDA, LIGA_TOPE_DIARIO, type JuegoLiga } from "./config";

export interface PuntosLiga {
  jugador: string | null | undefined;
  juego: JuegoLiga;
  puntos: number;
  /** Partida o sala: para el máximo por partida. */
  partidaRef: string;
  /** Evento único (pregunta, letra, palabra): evita contar dos veces. */
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

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/liga
git commit -m "Liga: reglas de puntos, nombres de iglesia y registro en el servidor"
```

---

### Task 3: Conectar los 4 juegos

**Files:**
- Modify: `src/app/api/juegos/palabra/intento/route.ts`
- Modify: `src/app/api/arena-publica/answer/route.ts`
- Modify: `src/app/api/ruleta/[codigo]/guess-consonant/route.ts`
- Modify: `src/app/api/ruleta/[codigo]/guess-vowel/route.ts`
- Modify: `src/app/api/ruleta/[codigo]/resolve/route.ts`
- Modify: `src/lib/juegos/ahorcado.server.ts`

- [ ] **Step 1: Palabra del Día.** En `intento/route.ts` cambiar el import de `next/server` a `import { NextResponse, after } from "next/server";` y agregar:

```ts
import { registrarPuntosLiga } from "@/lib/liga/registrar.server";
import { puntosPalabraLiga } from "@/lib/liga/config";
```

Justo antes de `await recalcularRacha(user.id, service);`:

```ts
  // Liga de Iglesias: solo partidas con sesión (esta ruta), una vez por día.
  if (resuelta) {
    const jugador = user.id;
    after(() =>
      registrarPuntosLiga({
        jugador,
        juego: "palabra",
        puntos: puntosPalabraLiga(intentos.length),
        partidaRef: hoy,
        eventoRef: hoy,
      })
    );
  }
```

- [ ] **Step 2: Trivia en línea.** En `arena-publica/answer/route.ts`: import `{ NextResponse, after }` de `next/server`, `registrarPuntosLiga` y `LIGA_PUNTOS` de `@/lib/liga/config`. Después de `if (pregunta.question_id) await registrarRespuesta(...)`:

```ts
  if (esCorrecta) {
    after(() =>
      registrarPuntosLiga({
        jugador: user.id,
        juego: "trivia",
        puntos: LIGA_PUNTOS.triviaPorCorrecta,
        partidaRef: sala.id,
        eventoRef: pregunta.id,
      })
    );
  }
```

- [ ] **Step 3: Ruleta, consonante.** En `guess-consonant/route.ts`: import `{ NextResponse, after }`, `registrarPuntosLiga` y `LIGA_PUNTOS`. En la rama `count > 0`, cambiar el select del jugador a `.select("id, puntos, user_id")`. Antes de `await channel.send({` de esa rama:

```ts
    if (jugador?.user_id) {
      const userId = jugador.user_id as string;
      after(() =>
        registrarPuntosLiga({
          jugador: userId,
          juego: "ruleta",
          puntos: LIGA_PUNTOS.ruletaPorLetra,
          partidaRef: sala.id,
          eventoRef: `${ronda.id}:${letra}`,
        })
      );
    }
```

- [ ] **Step 4: Ruleta, vocal.** En `guess-vowel/route.ts`, en la rama `count > 0`: import igual, el select de `jugadorFresco` pasa a `.select("id, puntos, user_id")` y, después de actualizar la ronda (`rondaUpdateError` sin error) y antes del `channel.send`:

```ts
    if (jugadorFresco.user_id) {
      const userId = jugadorFresco.user_id as string;
      after(() =>
        registrarPuntosLiga({
          jugador: userId,
          juego: "ruleta",
          puntos: LIGA_PUNTOS.ruletaPorLetra,
          partidaRef: sala.id,
          eventoRef: `${ronda.id}:${letra}`,
        })
      );
    }
```

(Usar los nombres de variable `ronda` y `letra` tal como existen en ese archivo. Si la vocal se llama distinto, usar ese nombre.)

- [ ] **Step 5: Ruleta, resolver.** En `resolve/route.ts`, rama `acierto`: import igual, select de `jugadorFresco` a `.select("id, puntos, user_id")`, y antes de `await channel.send({`:

```ts
    if (jugadorFresco.user_id) {
      const userId = jugadorFresco.user_id as string;
      after(() =>
        registrarPuntosLiga({
          jugador: userId,
          juego: "ruleta",
          puntos: LIGA_PUNTOS.ruletaPorResolver,
          partidaRef: sala.id,
          eventoRef: `${ronda.id}:resolver`,
        })
      );
    }
```

- [ ] **Step 6: Ahorcado.** En `src/lib/juegos/ahorcado.server.ts` agregar los imports `import { after } from "next/server";`, `import { registrarPuntosLiga } from "@/lib/liga/registrar.server";` y `import { LIGA_PUNTOS } from "@/lib/liga/config";`. En `adivinarLetra`, después de `if (estado === "ganada") nuevoRecord = await guardarRanking(...)`:

```ts
  if (estado === "ganada") {
    const ref = `${corrida.palabra_id ?? "sin-palabra"}:${actualizada.updated_at}`;
    after(() =>
      registrarPuntosLiga({
        jugador: userId,
        juego: "ahorcado",
        puntos: LIGA_PUNTOS.ahorcadoPorPalabra,
        partidaRef: ref,
        eventoRef: ref,
      })
    );
  }
```

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/juegos/palabra/intento/route.ts src/app/api/arena-publica/answer/route.ts "src/app/api/ruleta/[codigo]" src/lib/juegos/ahorcado.server.ts
git commit -m "Liga: los 4 juegos registran puntos al validar en el servidor"
```

---

### Task 4: Consultas de la Liga

**Files:**
- Create: `src/lib/liga/consultas.server.ts`

- [ ] **Step 1: Escribir las consultas**

```ts
// src/lib/liga/consultas.server.ts
//
// Lecturas de la Liga con service role (liga_puntos no se puede leer
// desde el navegador). Al cliente solo salen nombres de iglesia, puntos y,
// de los jugadores, nombre corto y foto SOLO si dieron permiso.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { fechaDeHoy } from "@/lib/palabra/servidor";
import { inicioDeSemana, sumarDias } from "@/lib/palabra/logica";
import { NOMBRE_SIN_PERMISO, nombreCorto } from "@/lib/palabra/puntos";
import { nombreIglesia, type IglesiaBase } from "./nombre";

type Servicio = Awaited<ReturnType<typeof createServiceClient>>;

export interface FilaLiga {
  id: string;
  lugar: number;
  nombre: string;
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
  aprobada: boolean;
  lugar: number | null;
  puntos: number;
  /** Puntos que faltan para pasar a la de arriba; null si va primero o no hay tabla. */
  faltan: number | null;
  siguiente: string | null;
  campeona: boolean;
}

export interface TablaLiga {
  semana: string;
  conSesion: boolean;
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

async function aprobadas(service: Servicio): Promise<IglesiaBase[]> {
  const { data } = await service.from("iglesias").select("id, ciudad, estado, pais").eq("aprobada", true);
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

/** Iglesia del usuario (aprobada o pendiente) y si hay que preguntarle. */
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
    s.from("iglesias").select("id, ciudad, estado, pais, aprobada").eq("id", id).maybeSingle(),
    aprobadas(s),
  ]);
  if (!fila) return { iglesia: null, preguntada, cambiadaEn };
  return {
    iglesia: { id, nombre: nombreIglesia(fila as IglesiaBase, todas), aprobada: fila.aprobada === true },
    preguntada,
    cambiadaEn,
  };
}

async function perfilesPublicos(
  service: Servicio,
  ids: string[]
): Promise<Map<string, { nombre: string; avatar: string | null; permiso: boolean }>> {
  const mapa = new Map<string, { nombre: string; avatar: string | null; permiso: boolean }>();
  if (ids.length === 0) return mapa;
  const { data } = await service.from("profiles").select("id, display_name, avatar_url, tiktok_permiso").in("id", ids);
  for (const p of (data ?? []) as Array<Record<string, unknown>>) {
    mapa.set(p.id as string, {
      nombre: ((p.display_name as string | null) ?? "").trim() || "Jugador",
      avatar: (p.avatar_url as string | null) ?? null,
      permiso: p.tiktok_permiso === true,
    });
  }
  return mapa;
}

export async function getTablaLiga(userId: string | null): Promise<TablaLiga> {
  const service = await createServiceClient();
  const semana = semanaActual();
  const [todas, filas, campeonaId, mi] = await Promise.all([
    aprobadas(service),
    tablaSql(service, semana),
    campeonaDe(service, sumarDias(semana, -7)),
    userId ? getMiIglesia(userId, service) : Promise.resolve(null),
  ]);
  const porId = new Map(todas.map((i) => [i.id, i]));
  const nombreDe = (id: string) => {
    const ig = porId.get(id);
    return ig ? nombreIglesia(ig, todas) : "Iglesia";
  };

  const conLugar: FilaLiga[] = filas.map((f, i) => ({
    id: f.iglesia_id,
    lugar: i + 1,
    nombre: nombreDe(f.iglesia_id),
    puntos: f.puntos,
    jugadores: f.jugadores,
    campeona: f.iglesia_id === campeonaId,
  }));

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
      aprobada: propia.aprobada,
      lugar: fila?.lugar ?? null,
      puntos,
      faltan: propia.aprobada && arriba ? arriba.puntos - puntos + 1 : null,
      siguiente: propia.aprobada && arriba ? arriba.nombre : null,
      campeona: propia.id === campeonaId,
    };
  }

  let jugadores: JugadorLiga[] = [];
  if (propia) {
    const { data } = await service.rpc("liga_jugadores_semana", {
      p_semana: semana,
      p_iglesia: propia.id,
      p_limite: 10,
    });
    const lista = (data ?? []) as Array<{ jugador: string; puntos: number }>;
    const perfiles = await perfilesPublicos(service, lista.map((j) => j.jugador));
    jugadores = lista.map((j, i) => {
      const p = perfiles.get(j.jugador);
      const conPermiso = p?.permiso === true;
      return {
        lugar: i + 1,
        nombre: conPermiso && p ? nombreCorto(p.nombre) : NOMBRE_SIN_PERMISO,
        avatar: conPermiso ? (p?.avatar ?? null) : null,
        puntos: j.puntos,
        esYo: j.jugador === userId,
      };
    });
  }

  return { semana, conSesion: userId !== null, top: conLugar.slice(0, 10), mia, jugadores };
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
    return {
      semana: c.semana,
      nombre: ig ? nombreIglesia(ig, todas) : "Iglesia que ya no existe",
      puntos: c.puntos,
      jugadores: c.jugadores,
    };
  });
}

export interface DatosTarjetaLiga {
  semana: string;
  top3: Array<{ nombre: string; puntos: number }>;
  mejor: { nombre: string; avatar: string | null; puntos: number; iglesia: string | null } | null;
}

/** Para la tarjeta de TikTok: top 3 y el mejor jugador SOLO si dio permiso. */
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
    return { nombre: ig ? nombreIglesia(ig, todas) : "Iglesia", puntos: f.puntos };
  });

  let mejor: DatosTarjetaLiga["mejor"] = null;
  const primero = ((jug ?? []) as Array<{ jugador: string; puntos: number }>)[0];
  if (primero) {
    const perfiles = await perfilesPublicos(service, [primero.jugador]);
    const p = perfiles.get(primero.jugador);
    if (p?.permiso) {
      const { iglesia } = await getMiIglesia(primero.jugador, service);
      mejor = {
        nombre: nombreCorto(p.nombre),
        avatar: p.avatar,
        puntos: primero.puntos,
        iglesia: iglesia?.aprobada ? iglesia.nombre : null,
      };
    }
  }
  return { semana, top3, mejor };
}

/** Semanas para el selector de la tarjeta: la actual y las cerradas. */
export async function getSemanasTarjeta(): Promise<string[]> {
  const service = await createServiceClient();
  const { data } = await service.from("liga_campeonas").select("semana").order("semana", { ascending: false }).limit(11);
  const actual = semanaActual();
  const cerradas = ((data ?? []) as Array<{ semana: string }>).map((c) => c.semana).filter((s) => s !== actual);
  return [actual, ...cerradas];
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/liga/consultas.server.ts
git commit -m "Liga: consultas de tabla, mi iglesia, campeonas y tarjeta"
```

---

### Task 5: API de iglesias y de la tabla

**Files:**
- Create: `src/app/api/liga/iglesias/route.ts`, `src/app/api/liga/mi-iglesia/route.ts`, `src/app/api/liga/no-preguntar/route.ts`, `src/app/api/liga/tabla/route.ts`

- [ ] **Step 1: Buscar**

```ts
// src/app/api/liga/iglesias/route.ts
// Busca iglesias aprobadas por ciudad (sin acentos ni mayúsculas).
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { detalleIglesia, nombreIglesia, normalizar, type IglesiaBase } from "@/lib/liga/nombre";

export async function GET(request: Request) {
  const q = normalizar(new URL(request.url).searchParams.get("q") ?? "");
  if (q.length < 2) return NextResponse.json({ iglesias: [] });

  const service = await createServiceClient();
  const { data, error } = await service.from("iglesias").select("id, ciudad, estado, pais").eq("aprobada", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todas = (data ?? []) as IglesiaBase[];
  const coinciden = todas
    .filter((i) => normalizar(i.ciudad).includes(q) || normalizar(`${i.ciudad} ${i.estado} ${i.pais}`).includes(q))
    .sort((a, b) => Number(!normalizar(a.ciudad).startsWith(q)) - Number(!normalizar(b.ciudad).startsWith(q)) || a.ciudad.localeCompare(b.ciudad))
    .slice(0, 10)
    .map((i) => ({ id: i.id, nombre: nombreIglesia(i, todas), detalle: detalleIglesia(i) }));

  return NextResponse.json({ iglesias: coinciden });
}
```

- [ ] **Step 2: Elegir o agregar**

```ts
// src/app/api/liga/mi-iglesia/route.ts
//
// Elegir una iglesia aprobada ({ iglesia_id }) o agregar una nueva
// ({ nueva: { ciudad, estado, pais }, confirmar? }). La nueva queda
// pendiente hasta que el admin la apruebe. Cambiar de iglesia: una vez
// cada 30 días (la primera elección no cuenta como cambio).
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { claveIglesia, detalleIglesia, limpiar, nombreIglesia, normalizar, type IglesiaBase } from "@/lib/liga/nombre";
import { LIGA_DIAS_CAMBIO } from "@/lib/liga/config";

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
  if (!user) return NextResponse.json({ error: "Inicia sesión para elegir tu iglesia" }, { status: 401 });

  let body: { iglesia_id?: unknown; nueva?: { ciudad?: unknown; estado?: unknown; pais?: unknown }; confirmar?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: perfil } = await service
    .from("profiles")
    .select("iglesia_id, iglesia_cambiada_en, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  const anterior = (perfil.iglesia_id as string | null) ?? null;

  const { data: aprobadasData } = await service.from("iglesias").select("id, ciudad, estado, pais").eq("aprobada", true);
  const aprobadas = (aprobadasData ?? []) as IglesiaBase[];

  let destino: { id: string; aprobada: boolean; fila: IglesiaBase } | null = null;

  if (typeof body.iglesia_id === "string") {
    const { data } = await service
      .from("iglesias")
      .select("id, ciudad, estado, pais, aprobada")
      .eq("id", body.iglesia_id)
      .maybeSingle();
    if (!data || data.aprobada !== true) return NextResponse.json({ error: "Esa iglesia no está disponible" }, { status: 404 });
    destino = { id: data.id as string, aprobada: true, fila: data as IglesiaBase };
  } else if (body.nueva) {
    const ciudad = texto(body.nueva.ciudad);
    const estado = texto(body.nueva.estado);
    const pais = texto(body.nueva.pais);
    if (!ciudad || !estado || !pais) {
      return NextResponse.json({ error: "Escribe ciudad, estado y país (máximo 60 letras cada uno)" }, { status: 400 });
    }
    const clave = claveIglesia(ciudad, estado, pais);
    const { data: existente } = await service
      .from("iglesias")
      .select("id, ciudad, estado, pais, aprobada")
      .eq("clave", clave)
      .maybeSingle();
    if (existente) {
      destino = { id: existente.id as string, aprobada: existente.aprobada === true, fila: existente as IglesiaBase };
    } else {
      const similares = aprobadas.filter((i) => normalizar(i.ciudad) === normalizar(ciudad));
      if (similares.length > 0 && body.confirmar !== true) {
        return NextResponse.json({
          similares: similares.map((i) => ({ id: i.id, nombre: nombreIglesia(i, aprobadas), detalle: detalleIglesia(i) })),
        });
      }
      const { data: creada, error } = await service
        .from("iglesias")
        .insert({ ciudad, estado, pais, clave, aprobada: false, creada_por: user.id })
        .select("id, ciudad, estado, pais")
        .single();
      if (error || !creada) return NextResponse.json({ error: error?.message ?? "No se pudo agregar" }, { status: 500 });
      destino = { id: creada.id as string, aprobada: false, fila: creada as IglesiaBase };
    }
  } else {
    return NextResponse.json({ error: "Elige o agrega una iglesia" }, { status: 400 });
  }

  if (anterior === destino.id) {
    return NextResponse.json({ iglesia: { id: destino.id, nombre: nombreIglesia(destino.fila, aprobadas), aprobada: destino.aprobada } });
  }

  if (anterior) {
    const ultima = perfil.iglesia_cambiada_en ? Date.parse(perfil.iglesia_cambiada_en as string) : 0;
    const libre = ultima + LIGA_DIAS_CAMBIO * DIA_MS;
    if (ultima && Date.now() < libre) {
      const fecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "America/Los_Angeles" }).format(new Date(libre));
      return NextResponse.json({ error: `Solo puedes cambiar de iglesia una vez cada ${LIGA_DIAS_CAMBIO} días. Podrás cambiarla el ${fecha}.` }, { status: 409 });
    }
  }

  const { error: errPerfil } = await service
    .from("profiles")
    .update({
      iglesia_id: destino.id,
      iglesia_preguntada: true,
      ...(anterior ? { iglesia_cambiada_en: new Date().toISOString() } : {}),
    })
    .eq("id", user.id);
  if (errPerfil) return NextResponse.json({ error: errPerfil.message }, { status: 500 });

  if (!anterior) {
    await service.rpc("liga_asignar_sin_iglesia", { p_jugador: user.id, p_iglesia: destino.id });
  }

  return NextResponse.json({
    iglesia: { id: destino.id, nombre: nombreIglesia(destino.fila, aprobadas), aprobada: destino.aprobada },
  });
}
```

Nota: la primera elección no pone `iglesia_cambiada_en`, así el primer cambio real queda libre. El plazo de 30 días cuenta desde el último cambio.

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
// La pide /juegos/liga cada 30 segundos.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTablaLiga } from "@/lib/liga/consultas.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tabla = await getTablaLiga(user?.id ?? null);
  return NextResponse.json(tabla, { headers: { "Cache-Control": "no-store" } });
}
```

- [ ] **Step 5: Verificar tipos y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/app/api/liga
git commit -m "Liga: API para buscar, elegir y agregar iglesia, y tabla"
```

---

### Task 6: Selector y aviso de iglesia en los 4 juegos

**Files:**
- Create: `src/components/juegos/liga/SelectorIglesia.tsx`, `src/components/juegos/liga/AvisoIglesia.tsx`, `src/components/juegos/liga/AvisoIglesiaLiga.tsx`
- Modify: `src/app/(public)/juegos/palabra/page.tsx`, `src/app/(public)/arena-abierta/page.tsx`, `src/app/(public)/ruleta/page.tsx`, `src/app/(public)/juegos/ahorcado/page.tsx`

- [ ] **Step 1: `SelectorIglesia.tsx`**

```tsx
// src/components/juegos/liga/SelectorIglesia.tsx
"use client";

import { useEffect, useState } from "react";
import { Church, Loader2, Plus, Search } from "lucide-react";

export interface IglesiaElegida {
  id: string;
  nombre: string;
  aprobada: boolean;
}

interface Opcion {
  id: string;
  nombre: string;
  detalle: string;
}

const inputEstilo = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

export function SelectorIglesia({ onElegida }: { onElegida: (iglesia: IglesiaElegida) => void }) {
  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [nueva, setNueva] = useState({ ciudad: "", estado: "", pais: "" });
  const [similares, setSimilares] = useState<Opcion[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setOpciones([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`/api/liga/iglesias?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { iglesias?: Opcion[] };
        setOpciones(data.iglesias ?? []);
      } catch {
        setOpciones([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function enviar(cuerpo: object) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/liga/mi-iglesia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = (await res.json()) as { iglesia?: IglesiaElegida; similares?: Opcion[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      if (data.similares) {
        setSimilares(data.similares);
        return;
      }
      if (data.iglesia) onElegida(data.iglesia);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  const lista = (items: Opcion[]) => (
    <ul className="flex flex-col gap-2">
      {items.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void enviar({ iglesia_id: o.id })}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-left min-h-11"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
          >
            <Church size={18} style={{ color: "var(--color-primary)" }} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold" style={{ color: "var(--color-text)" }}>{o.nombre}</span>
              <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{o.detalle}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  if (similares) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: "var(--color-text)" }}>¿Es alguna de estas?</p>
        {lista(similares)}
        <button
          type="button"
          disabled={guardando}
          onClick={() => void enviar({ nueva, confirmar: true })}
          className="py-2.5 rounded-xl text-sm font-semibold min-h-11"
          style={{ ...inputEstilo, color: "var(--color-text-muted)" }}
        >
          No, agregar {nueva.ciudad} como iglesia nueva
        </button>
        {error && <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{error}</p>}
      </div>
    );
  }

  if (agregando) {
    const listo = nueva.ciudad.trim() && nueva.estado.trim() && nueva.pais.trim();
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (listo) void enviar({ nueva });
        }}
      >
        {(["ciudad", "estado", "pais"] as const).map((campo) => (
          <input
            key={campo}
            value={nueva[campo]}
            onChange={(e) => setNueva({ ...nueva, [campo]: e.target.value })}
            maxLength={60}
            placeholder={campo === "ciudad" ? "Ciudad" : campo === "estado" ? "Estado o provincia" : "País"}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={inputEstilo}
          />
        ))}
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Queda pendiente hasta que la aprobemos. Tus puntos se guardan desde ya.
        </p>
        {error && <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setAgregando(false)} className="flex-1 py-2.5 rounded-xl text-sm min-h-11" style={{ ...inputEstilo, color: "var(--color-text-muted)" }}>
            Volver
          </button>
          <button type="submit" disabled={!listo || guardando} className="flex-1 py-2.5 rounded-xl text-sm font-bold min-h-11 disabled:opacity-60" style={{ background: "var(--color-primary)", color: "#000" }}>
            {guardando ? "Guardando…" : "Agregar mi iglesia"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-xl px-3" style={inputEstilo}>
        <Search size={16} style={{ color: "var(--color-text-muted)" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escribe tu ciudad"
          className="flex-1 bg-transparent py-2.5 text-sm outline-none"
          style={{ color: "var(--color-text)" }}
          autoFocus
        />
        {buscando && <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />}
      </label>
      {opciones.length > 0 && lista(opciones)}
      {q.trim().length >= 2 && !buscando && opciones.length === 0 && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Todavía no está tu ciudad.</p>
      )}
      <button
        type="button"
        onClick={() => {
          setNueva({ ciudad: q.trim(), estado: "", pais: "" });
          setAgregando(true);
        }}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold min-h-11"
        style={{ border: "1px dashed var(--color-border)", color: "var(--color-primary)" }}
      >
        <Plus size={16} /> Mi ciudad no aparece
      </button>
      {error && <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: `AvisoIglesia.tsx` (modal)**

```tsx
// src/components/juegos/liga/AvisoIglesia.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
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
      // Si falla, se le vuelve a preguntar la próxima vez; no pasa nada.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} role="dialog" aria-modal="true" aria-labelledby="aviso-iglesia-titulo">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--color-surface)", border: "1px solid rgba(212,160,23,0.4)" }}>
        {elegida ? (
          <>
            <p id="aviso-iglesia-titulo" className="text-lg font-bold" style={{ color: "var(--color-text)" }}>¡Listo! 🙌</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {elegida.aprobada
                ? `Tus puntos sumarán para la ${elegida.nombre}.`
                : `Agregamos la ${elegida.nombre}. Cuando la aprobemos, tus puntos empezarán a sumar.`}
            </p>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                router.refresh();
              }}
              className="py-2.5 rounded-xl text-sm font-bold min-h-11"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              A jugar
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Trophy size={20} style={{ color: "var(--color-primary)" }} />
              <p id="aviso-iglesia-titulo" className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
                ¿De qué ciudad es tu iglesia?
              </p>
            </div>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Tus puntos sumarán para tu iglesia en la Liga de Iglesias.</p>
            <SelectorIglesia onElegida={setElegida} />
            <button type="button" onClick={() => void ahoraNo()} className="text-sm underline min-h-11" style={{ color: "var(--color-text-muted)" }}>
              Ahora no
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `AvisoIglesiaLiga.tsx` (decide en el servidor)**

```tsx
// src/components/juegos/liga/AvisoIglesiaLiga.tsx
// Se monta en las páginas de los 4 juegos con el perfil que ya cargan.
// Solo sale a quien tiene sesión, no es admin, no tiene iglesia y no dijo
// "Ahora no".
import { AvisoIglesia } from "./AvisoIglesia";

interface PerfilLiga {
  role?: string | null;
  iglesia_id?: string | null;
  iglesia_preguntada?: boolean | null;
}

export function AvisoIglesiaLiga({ perfil }: { perfil: PerfilLiga | null }) {
  if (!perfil || perfil.role === "admin" || perfil.iglesia_id || perfil.iglesia_preguntada) return null;
  return <AvisoIglesia />;
}
```

- [ ] **Step 4: Montarlo en los 4 juegos.** En cada página, importar `import { AvisoIglesiaLiga } from "@/components/juegos/liga/AvisoIglesiaLiga";` y, en el `return (` **final** (el que se muestra cuando ya se puede jugar), poner como primer hijo del `<div>` de afuera:

```tsx
      <AvisoIglesiaLiga perfil={profile as { role?: string; iglesia_id?: string | null; iglesia_preguntada?: boolean } | null} />
```

Páginas: `src/app/(public)/juegos/palabra/page.tsx`, `src/app/(public)/arena-abierta/page.tsx`, `src/app/(public)/ruleta/page.tsx` y `src/app/(public)/juegos/ahorcado/page.tsx`. Todas ya tienen `const profile = await getProfile();`, que trae todas las columnas.

- [ ] **Step 5: Verificar tipos y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/components/juegos/liga "src/app/(public)/juegos/palabra/page.tsx" "src/app/(public)/arena-abierta/page.tsx" "src/app/(public)/ruleta/page.tsx" "src/app/(public)/juegos/ahorcado/page.tsx"
git commit -m "Liga: aviso para elegir la iglesia al entrar a los juegos"
```

---

### Task 7: Página /juegos/liga y tarjeta en /juegos

**Files:**
- Create: `src/components/juegos/liga/InvitarHermanos.tsx`, `src/components/juegos/liga/TablaLiga.tsx`, `src/components/juegos/liga/TarjetaLigaHub.tsx`, `src/app/(public)/juegos/liga/page.tsx`
- Modify: `src/app/(public)/juegos/page.tsx`

- [ ] **Step 1: `InvitarHermanos.tsx`**

```tsx
// src/components/juegos/liga/InvitarHermanos.tsx
"use client";

import { MessageCircle, Share2 } from "lucide-react";
import { textoInvitacion } from "@/lib/liga/config";

export function InvitarHermanos({ nombreIglesia }: { nombreIglesia: string | null }) {
  const texto = textoInvitacion(nombreIglesia);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(texto)}`;

  async function compartir() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: texto });
        return;
      } catch {
        // Canceló o no se pudo: no abrimos nada más.
        return;
      }
    }
    window.open(whatsapp, "_blank", "noopener");
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => void compartir()}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold min-h-11"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        <Share2 size={16} /> Invitar a mis hermanos
      </button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Invitar por WhatsApp"
        className="flex items-center justify-center px-4 rounded-xl min-h-11"
        style={{ background: "#25D366", color: "#000" }}
      >
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
import { InvitarHermanos } from "./InvitarHermanos";
import { SelectorIglesia } from "./SelectorIglesia";

const caja = { background: "var(--color-surface)", border: "1px solid var(--color-border)" } as const;

export function TablaLiga({ inicial }: { inicial: Tabla }) {
  const router = useRouter();
  const [tabla, setTabla] = useState(inicial);
  const [eligiendo, setEligiendo] = useState(false);

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

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "linear-gradient(135deg, rgba(212,160,23,0.14) 0%, var(--color-surface) 70%)", border: "1px solid rgba(212,160,23,0.45)" }}>
        {!tabla.conSesion ? (
          <>
            <p className="text-sm" style={{ color: "var(--color-text)" }}>Entra a tu cuenta para que tus puntos sumen para la iglesia de tu ciudad.</p>
            <Link href="/login?returnUrl=/juegos/liga" className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
              <LogIn size={16} /> Iniciar sesión
            </Link>
          </>
        ) : !mia ? (
          eligiendo ? (
            <SelectorIglesia
              onElegida={() => {
                setEligiendo(false);
                router.refresh();
              }}
            />
          ) : (
            <>
              <p className="text-sm" style={{ color: "var(--color-text)" }}>¿De qué ciudad es tu iglesia? Tus puntos sumarán para tu iglesia.</p>
              <button type="button" onClick={() => setEligiendo(true)} className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
                <Church size={16} /> Elegir mi iglesia
              </button>
            </>
          )
        ) : !mia.aprobada ? (
          <p className="text-sm" style={{ color: "var(--color-text)" }}>
            La <strong>{mia.nombre}</strong> está esperando aprobación. Tus puntos ya se están guardando.
          </p>
        ) : (
          <>
            <p className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
              {mia.lugar
                ? `La ${mia.nombre}${mia.campeona ? " 🏆" : ""} va en el lugar #${mia.lugar}`
                : `La ${mia.nombre}${mia.campeona ? " 🏆" : ""} todavía no tiene puntos esta semana`}
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {mia.lugar === 1
                ? "¡Van en primer lugar! Invita a tus hermanos para no perderlo."
                : mia.faltan && mia.siguiente
                  ? `¡Les faltan ${mia.faltan} puntos para pasar a la ${mia.siguiente}! Invita a tus hermanos.`
                  : "¡Jueguen para ser la primera iglesia en la tabla! Invita a tus hermanos."}
            </p>
          </>
        )}
        <InvitarHermanos nombreIglesia={mia?.aprobada ? mia.nombre : null} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Tabla de la semana</h2>
        {top.length === 0 ? (
          <p className="text-sm rounded-2xl p-5" style={{ ...caja, color: "var(--color-text-muted)" }}>Todavía no hay puntos esta semana. ¡Juega y pon a tu iglesia en la tabla!</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {top.map((f) => (
              <li key={f.id} className="rounded-xl p-3 flex flex-col gap-2" style={{ ...caja, borderColor: f.id === mia?.id ? "rgba(212,160,23,0.6)" : "var(--color-border)" }}>
                <div className="flex items-center gap-3">
                  <span className="w-7 text-center text-sm font-bold tabular-nums" style={{ color: f.lugar <= 3 ? "var(--color-primary)" : "var(--color-text-muted)" }}>#{f.lugar}</span>
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                    {f.nombre}{f.campeona ? " 🏆" : ""}
                  </span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "var(--color-text)" }}>{f.puntos} pts</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-elevated)" }}>
                    <div className="h-full rounded-full" style={{ width: `${maximo ? Math.max(4, Math.round((f.puntos / maximo) * 100)) : 0}%`, background: "var(--color-primary)" }} />
                  </div>
                  <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                    {f.jugadores} {f.jugadores === 1 ? "jugador" : "jugadores"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {mia?.aprobada && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Los mejores de mi iglesia esta semana</h2>
          {jugadores.length === 0 ? (
            <p className="text-sm rounded-2xl p-5" style={{ ...caja, color: "var(--color-text-muted)" }}>Nadie de tu iglesia ha sumado puntos esta semana. ¡Sé el primero!</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {jugadores.map((j) => (
                <li key={j.lugar} className="flex items-center gap-3 rounded-xl p-3" style={{ ...caja, borderColor: j.esYo ? "rgba(212,160,23,0.6)" : "var(--color-border)" }}>
                  <span className="w-6 text-center text-sm font-bold tabular-nums" style={{ color: "var(--color-text-muted)" }}>{j.lugar}</span>
                  {j.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={j.avatar} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs" style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}>
                      {j.nombre.charAt(0)}
                    </span>
                  )}
                  <span className="flex-1 min-w-0 text-sm truncate" style={{ color: "var(--color-text)" }}>
                    {j.nombre}{j.esYo ? " (tú)" : ""}
                  </span>
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

`TablaLiga` es un componente de cliente que importa **solo el tipo** de `consultas.server.ts` (`import type`), así que no arrastra código del servidor. Si el build se queja por `server-only`, mover las interfaces a `src/lib/liga/tipos.ts` y reexportarlas desde `consultas.server.ts`.

- [ ] **Step 3: Página**

```tsx
// src/app/(public)/juegos/liga/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { getHistorialCampeonas, getTablaLiga } from "@/lib/liga/consultas.server";
import { rangoSemana } from "@/lib/juegos/campeones/semana";
import { TablaLiga } from "@/components/juegos/liga/TablaLiga";

export const metadata: Metadata = {
  title: "Liga de Iglesias — Elim LLDM",
  description: "Juega y suma puntos para la iglesia de tu ciudad. Cada semana hay una iglesia campeona.",
};
export const dynamic = "force-dynamic";

export default async function LigaPage() {
  const profile = (await getProfile()) as { id: string } | null;
  const [tabla, historial] = await Promise.all([getTablaLiga(profile?.id ?? null), getHistorialCampeonas()]);

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">
        <Link href="/juegos" className="inline-flex items-center gap-1 text-sm min-h-11" style={{ color: "var(--color-text-muted)" }}>
          <ChevronLeft size={16} /> Juegos
        </Link>
        <header className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}>
            <Trophy size={28} style={{ color: "var(--color-primary)" }} />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>Liga de Iglesias</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{rangoSemana(tabla.semana)} · se reinicia cada lunes</p>
        </header>

        <TablaLiga inicial={tabla} />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Campeonas de semanas anteriores</h2>
          {historial.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>La primera campeona se anuncia el próximo lunes.</p>
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
import type { MiIglesiaLiga } from "@/lib/liga/consultas.server";

export function TarjetaLigaHub({ mia, lider }: { mia: MiIglesiaLiga | null; lider: string | null }) {
  const linea = mia?.aprobada && mia.lugar
    ? `La ${mia.nombre}${mia.campeona ? " 🏆" : ""} va en el lugar #${mia.lugar}`
    : lider
      ? `Va ganando la ${lider}. ¿Y tu iglesia?`
      : "Suma puntos para la iglesia de tu ciudad";
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

- [ ] **Step 5: Ponerla en /juegos.** En `src/app/(public)/juegos/page.tsx`:
  - importar `getTablaLiga` y `TarjetaLigaHub`;
  - agregar `getTablaLiga(profile?.id ?? null)` al final del `Promise.all` y nombrarlo `tablaLiga` en la desestructuración;
  - justo después de `<JuegosPresence … />`, poner:

```tsx
          <TarjetaLigaHub mia={tablaLiga.mia} lider={tablaLiga.top[0]?.nombre ?? null} />
```

- [ ] **Step 6: Verificar tipos y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/components/juegos/liga "src/app/(public)/juegos/liga" "src/app/(public)/juegos/page.tsx"
git commit -m "Liga: página /juegos/liga y tarjeta en /juegos"
```

---

### Task 8: Aviso para jugadores sin sesión

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
      <p className="flex-1 text-sm" style={{ color: "var(--color-text)" }}>
        ¿Quieres que tus puntos sumen para la Iglesia de tu ciudad? Entra a tu cuenta
      </p>
      <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold min-h-11" style={{ background: "var(--color-primary)", color: "#000" }}>
        <LogIn size={16} /> Iniciar sesión
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Mostrarlo al terminar Palabra del Día sin sesión.** En `PalabraGame.tsx` importar `import { InvitacionLiga } from "@/components/juegos/liga/InvitacionLiga";` y, debajo de `{!conSesion && !partida.terminada && <InvitacionSesion />}`, agregar:

```tsx
      {!conSesion && partida.terminada && revelandoFila === null && <InvitacionLiga returnUrl="/juegos/palabra" />}
```

- [ ] **Step 3: Verificar tipos y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/components/juegos/liga/InvitacionLiga.tsx src/components/juegos/palabra/PalabraGame.tsx
git commit -m "Liga: invitar a entrar a la cuenta al terminar sin sesión"
```

---

### Task 9: Cambiar iglesia en /perfil y ranking de Palabra con la tabla nueva

**Files:**
- Create: `src/components/juegos/liga/CambiarIglesia.tsx`
- Modify: `src/app/(public)/perfil/page.tsx`
- Modify: `src/lib/palabra/puntos.server.ts` (función `perfiles`)
- Modify: `src/app/(public)/juegos/palabra/page.tsx` (prop `usuario`)
- Modify: `src/components/juegos/palabra/PalabraRanking.tsx`

- [ ] **Step 1: `CambiarIglesia.tsx`**

```tsx
// src/components/juegos/liga/CambiarIglesia.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SelectorIglesia } from "./SelectorIglesia";

export function CambiarIglesia({ nombre, aprobada }: { nombre: string | null; aprobada: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  if (abierto) {
    return (
      <div className="flex flex-col gap-3">
        <SelectorIglesia
          onElegida={() => {
            setAbierto(false);
            router.refresh();
          }}
        />
        <button type="button" onClick={() => setAbierto(false)} className="text-sm underline min-h-11" style={{ color: "var(--color-text-muted)" }}>
          Cancelar
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <p className="flex-1 text-sm" style={{ color: "var(--color-text)" }}>
        {nombre ? (
          <>
            {nombre}
            {!aprobada && <span style={{ color: "var(--color-text-muted)" }}> · esperando aprobación</span>}
          </>
        ) : (
          <span style={{ color: "var(--color-text-muted)" }}>Todavía no eliges tu iglesia</span>
        )}
      </p>
      <button type="button" onClick={() => setAbierto(true)} className="px-3 py-2 rounded-lg text-sm font-semibold min-h-11" style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-primary)" }}>
        {nombre ? "Cambiar" : "Elegir"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Tarjeta en /perfil.** En `perfil/page.tsx`:
  - importar `getMiIglesia` de `@/lib/liga/consultas.server`, `CambiarIglesia` y `LIGA_DIAS_CAMBIO` de `@/lib/liga/config`;
  - después de cargar el perfil, agregar `const liga = await getMiIglesia(p.id as string);` (usar la variable del perfil que ya existe en esa página);
  - antes del bloque `{/* ── TIKTOK ── */}`, insertar:

```tsx
        {/* ── LIGA DE IGLESIAS ─────────────────────────────────────── */}
        <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Mi iglesia en la Liga</h2>
          <CambiarIglesia nombre={liga.iglesia?.nombre ?? null} aprobada={liga.iglesia?.aprobada ?? false} />
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Puedes cambiarla una vez cada {LIGA_DIAS_CAMBIO} días.</p>
        </div>
```

- [ ] **Step 3: Ranking de Palabra con `iglesia_id`.** En `src/lib/palabra/puntos.server.ts`, función `perfiles`:
  - cambiar el select a `"id, display_name, avatar_url, iglesia_id, role, tiktok_permiso"`;
  - antes del `for`, cargar las aprobadas y los nombres:

```ts
  const { data: igl } = await service.from("iglesias").select("id, ciudad, estado, pais").eq("aprobada", true);
  const aprob = (igl ?? []) as IglesiaBase[];
  const nombrePorId = new Map(aprob.map((i) => [i.id, nombreIglesia(i, aprob)]));
```

  - dentro del `for`, la línea de `iglesia` pasa a ser:

```ts
      iglesia: nombrePorId.get(p.iglesia_id as string) ?? null,
```

  Agregar `import { nombreIglesia, type IglesiaBase } from "@/lib/liga/nombre";`.

- [ ] **Step 4: Prop `usuario` de Palabra.** En `src/app/(public)/juegos/palabra/page.tsx`:
  - importar `getMiIglesia`;
  - calcular `const liga = profile ? await getMiIglesia(profile.id as string) : null;`;
  - cambiar la prop a:

```tsx
          usuario={profile ? { iglesia: liga?.iglesia?.aprobada ? liga.iglesia.nombre : "" } : null}
```

(`""` en vez de `null`, así PalabraRanking no abre el viejo formulario de texto libre.)

- [ ] **Step 5: PalabraRanking sin texto libre.** En `PalabraRanking.tsx`:
  - quitar el import de `PreguntaIglesia`;
  - `const preguntarIglesia = false;` en lugar de la expresión actual (o quitar la variable y la rama del ternario);
  - el pie que dice "Tu iglesia o ciudad: … cambiar" pasa a:

```tsx
                {usuario && (
                  <p className="text-[11px] text-center pt-3" style={{ color: "var(--color-text-muted)" }}>
                    Tu iglesia: <strong>{iglesia || "sin elegir"}</strong> ·{" "}
                    <a href="/juegos/liga" className="underline" style={{ color: "var(--color-primary)" }}>
                      {iglesia ? "ver la Liga" : "elegir mi iglesia"}
                    </a>
                  </p>
                )}
```

  Quitar `editando`/`setEditando` si quedan sin uso. `PreguntaIglesia.tsx` y `/api/juegos/palabra/iglesia` quedan sin uso, pero **no se borran** (regla del usuario: nunca `rm`).

- [ ] **Step 6: Verificar tipos y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/components/juegos/liga/CambiarIglesia.tsx "src/app/(public)/perfil/page.tsx" src/lib/palabra/puntos.server.ts "src/app/(public)/juegos/palabra/page.tsx" src/components/juegos/palabra/PalabraRanking.tsx
git commit -m "Liga: cambiar iglesia en el perfil y ranking de Palabra con la tabla de iglesias"
```

---

### Task 10: Texto de la casilla de permiso

**Files:**
- Modify: `src/lib/juegos/permiso-videos.ts`
- Modify: `src/app/api/cuenta/tiktok/route.ts` (solo el comentario de la línea 3)

- [ ] **Step 1:** En `permiso-videos.ts`, reemplazar el valor de `TEXTO_PERMISO_VIDEOS` por:

```ts
export const TEXTO_PERMISO_VIDEOS = "Acepto que mi nombre y foto aparezcan en la Liga y en los videos de Elim LLDM";
```

Y actualizar el comentario de arriba: "lo usan la casilla de /perfil, la de cada juego en /juegos, la que sale al terminar una partida, y también decide si el nombre y la foto salen en la Liga de Iglesias".

- [ ] **Step 2:** En `cuenta/tiktok/route.ts`, el comentario de la línea 3 pasa a mencionar el texto nuevo.

- [ ] **Step 3: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/lib/juegos/permiso-videos.ts src/app/api/cuenta/tiktok/route.ts
git commit -m "Casilla de permiso: nombre y foto en la Liga y en los videos"
```

---

### Task 11: Cron de cierre semanal

**Files:**
- Create: `src/app/api/cron/liga-cierre/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Ruta**

```ts
// src/app/api/cron/liga-cierre/route.ts
//
// Cron del lunes (ver vercel.json): corre 07:05 y 08:05 UTC para caer a
// las 00:05 del Pacífico con y sin horario de verano. Guarda la campeona
// de la semana pasada; si ya estaba guardada, no hace nada.
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
  console.log("[cron/liga-cierre]", semana, data ? "campeona guardada" : "sin cambios");
  return NextResponse.json({ semana, guardada: data === true });
}
```

- [ ] **Step 2: `vercel.json`.** Agregar al arreglo `crons`:

```json
    {
      "path": "/api/cron/liga-cierre",
      "schedule": "5 7 * * 1"
    },
    {
      "path": "/api/cron/liga-cierre",
      "schedule": "5 8 * * 1"
    }
```

- [ ] **Step 3: Verificar y commit**

Run: `npx tsc --noEmit` → sin errores. Revisar que `vercel.json` siga siendo JSON válido: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"`.

```bash
git add src/app/api/cron/liga-cierre vercel.json
git commit -m "Liga: cron del lunes que guarda la iglesia campeona"
```

---

### Task 12: Admin, iglesias pendientes y aprobadas

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

function volver(error?: string): never {
  revalidatePath("/admin/liga");
  revalidatePath("/juegos/liga");
  redirect(error ? `/admin/liga?error=${encodeURIComponent(error)}` : "/admin/liga");
}

export async function aprobarIglesia(formData: FormData) {
  if (!(await adminId())) volver("Solo un administrador puede hacer esto");
  const id = String(formData.get("id") ?? "");
  const service = await createServiceClient();
  const { error } = await service.from("iglesias").update({ aprobada: true }).eq("id", id);
  volver(error?.message);
}

/** Rechazar: sus jugadores quedan sin iglesia (les vuelve a salir el aviso). */
export async function rechazarIglesia(formData: FormData) {
  if (!(await adminId())) volver("Solo un administrador puede hacer esto");
  const id = String(formData.get("id") ?? "");
  const service = await createServiceClient();
  const { error: e1 } = await service.from("profiles").update({ iglesia_id: null, iglesia_preguntada: false }).eq("iglesia_id", id);
  if (e1) volver(e1.message);
  const { error } = await service.from("iglesias").delete().eq("id", id).eq("aprobada", false);
  volver(error?.message);
}

export async function juntarIglesias(formData: FormData) {
  if (!(await adminId())) volver("Solo un administrador puede hacer esto");
  const quitar = String(formData.get("id") ?? "");
  const conservar = String(formData.get("conservar") ?? "");
  if (!conservar) volver("Elige con cuál iglesia juntarla");
  const service = await createServiceClient();
  const { error } = await service.rpc("liga_juntar_iglesias", { p_conservar: conservar, p_quitar: quitar });
  volver(error?.message);
}

export async function editarIglesia(formData: FormData) {
  if (!(await adminId())) volver("Solo un administrador puede hacer esto");
  const id = String(formData.get("id") ?? "");
  const ciudad = limpiar(String(formData.get("ciudad") ?? ""));
  const estado = limpiar(String(formData.get("estado") ?? ""));
  const pais = limpiar(String(formData.get("pais") ?? ""));
  if (!ciudad || !estado || !pais) volver("Ciudad, estado y país son obligatorios");
  const service = await createServiceClient();
  const { error } = await service
    .from("iglesias")
    .update({ ciudad, estado, pais, clave: claveIglesia(ciudad, estado, pais) })
    .eq("id", id);
  volver(error ? (error.code === "23505" ? "Ya existe otra iglesia con esa ciudad, estado y país" : error.message) : undefined);
}
```

- [ ] **Step 2: `page.tsx`**

```tsx
// src/app/admin/liga/page.tsx
// Liga de Iglesias (solo admin; admin/layout.tsx ya lo revisa).
import { Trophy } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { nombreIglesia, normalizar, type IglesiaBase } from "@/lib/liga/nombre";
import { getDatosTarjetaLiga, getSemanasTarjeta, semanaActual } from "@/lib/liga/consultas.server";
import { rangoCorto } from "@/lib/juegos/campeones/semana";
import { TarjetaLiga } from "@/components/admin/liga/TarjetaLiga";
import { aprobarIglesia, editarIglesia, juntarIglesias, rechazarIglesia } from "./acciones";

export const metadata = { title: "Liga de Iglesias — Admin" };
export const dynamic = "force-dynamic";

interface Fila extends IglesiaBase {
  aprobada: boolean;
  creada_en: string;
  creada_por: string | null;
}

const boton = "px-3 py-2 rounded-lg text-xs font-semibold min-h-9";
const campo = { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" } as const;

export default async function AdminLigaPage({ searchParams }: { searchParams: Promise<{ error?: string; semana?: string }> }) {
  const { error, semana: pedida } = await searchParams;
  const service = await createServiceClient();
  const semana = semanaActual();

  const [{ data: igl }, { data: perf }, { data: pts }, semanas] = await Promise.all([
    service.from("iglesias").select("id, ciudad, estado, pais, aprobada, creada_en, creada_por").order("ciudad"),
    service.from("profiles").select("id, iglesia_id, display_name").not("iglesia_id", "is", null),
    service.from("liga_puntos").select("iglesia_id, puntos").eq("semana", semana),
    getSemanasTarjeta(),
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <Trophy size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>Liga de Iglesias</h1>
      </div>
      {error && <p className="text-sm p-3 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-destructive)" }}>{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Pendientes de aprobar ({pendientes.length})</h2>
        {pendientes.length === 0 && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No hay iglesias pendientes.</p>}
        {pendientes.map((i) => {
          const parecidas = aprobadas.filter((a) => normalizar(a.ciudad) === normalizar(i.ciudad));
          return (
            <div key={i.id} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{i.ciudad}, {i.estado}, {i.pais}</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Propuesta por {i.creada_por ? (nombres.get(i.creada_por) ?? "un jugador") : "—"} · {jugadores.get(i.id) ?? 0} jugadores · {puntos.get(i.id) ?? 0} pts esta semana
                </p>
                {parecidas.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-primary)" }}>
                    Parecidas: {parecidas.map((a) => `${a.ciudad}, ${a.estado}, ${a.pais}`).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={aprobarIglesia}><input type="hidden" name="id" value={i.id} /><button className={boton} style={{ background: "var(--color-primary)", color: "#000" }}>Aprobar</button></form>
                <form action={rechazarIglesia}><input type="hidden" name="id" value={i.id} /><button className={boton} style={{ ...campo, color: "var(--color-destructive)" }}>Rechazar</button></form>
                {aprobadas.length > 0 && (
                  <form action={juntarIglesias} className="flex gap-2">
                    <input type="hidden" name="id" value={i.id} />
                    <select name="conservar" defaultValue={parecidas[0]?.id ?? ""} className="px-2 rounded-lg text-xs" style={campo}>
                      <option value="">Juntar con…</option>
                      {aprobadas.map((a) => <option key={a.id} value={a.id}>{a.ciudad}, {a.estado}, {a.pais}</option>)}
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
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Aprobadas ({aprobadas.length})</h2>
        {aprobadas.map((i) => (
          <details key={i.id} className="rounded-xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <summary className="text-sm cursor-pointer" style={{ color: "var(--color-text)" }}>
              {nombreIglesia(i, aprobadas)} · <span style={{ color: "var(--color-text-muted)" }}>{i.estado}, {i.pais} · {jugadores.get(i.id) ?? 0} jugadores · {puntos.get(i.id) ?? 0} pts</span>
            </summary>
            <form action={editarIglesia} className="flex flex-wrap gap-2 mt-3">
              <input type="hidden" name="id" value={i.id} />
              <input name="ciudad" defaultValue={i.ciudad} maxLength={60} className="px-2 py-1.5 rounded-lg text-sm" style={campo} />
              <input name="estado" defaultValue={i.estado} maxLength={60} className="px-2 py-1.5 rounded-lg text-sm" style={campo} />
              <input name="pais" defaultValue={i.pais} maxLength={60} className="px-2 py-1.5 rounded-lg text-sm" style={campo} />
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

- [ ] **Step 4: Commit** (la tarjeta va en la Task 13; hasta entonces tsc falla por el import. Hacer el commit junto con la Task 13).

---

### Task 13: Tarjeta 1080x1920 para TikTok

**Files:**
- Create: `src/components/admin/liga/TarjetaLiga.tsx`

- [ ] **Step 1: Componente**

```tsx
// src/components/admin/liga/TarjetaLiga.tsx
//
// Imagen vertical 1080x1920 de la Liga para TikTok: título con la semana,
// las 3 primeras iglesias y el mejor jugador SOLO si dio permiso. La foto
// se baja con /api/admin/palabra/tiktok/foto (mismo dominio) para que el
// lienzo no quede "sucio" por CORS y se pueda descargar el PNG.
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

function cargar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function ajustar(ctx: CanvasRenderingContext2D, texto: string, maxAncho: number, tamano: number, peso = 700): number {
  let t = tamano;
  do {
    ctx.font = `${peso} ${t}px Inter, system-ui, sans-serif`;
    if (ctx.measureText(texto).width <= maxAncho) break;
    t -= 2;
  } while (t > 28);
  return t;
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
  ctx.font = "700 56px Inter, system-ui, sans-serif";
  ctx.fillText("ELIM LLDM", ANCHO / 2, 200);
  ctx.fillStyle = TEXTO;
  ctx.font = "800 104px Inter, system-ui, sans-serif";
  ctx.fillText("Liga de Iglesias", ANCHO / 2, 340);
  ctx.fillStyle = GRIS;
  ctx.font = "500 44px Inter, system-ui, sans-serif";
  ctx.fillText(`Semana: ${rangoSemana(d.semana)}`, ANCHO / 2, 420);

  let y = 560;
  if (d.top3.length === 0) {
    ctx.fillStyle = GRIS;
    ctx.font = "500 48px Inter, system-ui, sans-serif";
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
    ctx.font = "96px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(MEDALLAS[i], 130, y + 145);
    ctx.fillStyle = TEXTO;
    ajustar(ctx, f.nombre, ANCHO - 420, 60);
    ctx.fillText(f.nombre, 270, y + 110);
    ctx.fillStyle = ORO;
    ctx.font = "700 52px Inter, system-ui, sans-serif";
    ctx.fillText(`${f.puntos} puntos`, 270, y + 180);
    ctx.textAlign = "center";
    y += alto + 40;
  });

  if (d.mejor) {
    y = Math.max(y + 40, 1420);
    ctx.fillStyle = GRIS;
    ctx.font = "600 42px Inter, system-ui, sans-serif";
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
      ctx.font = "700 90px Inter, system-ui, sans-serif";
      ctx.fillText(d.mejor.nombre.charAt(0), cx, cy + 32);
    }
    ctx.restore();
    ctx.fillStyle = TEXTO;
    ctx.font = "700 56px Inter, system-ui, sans-serif";
    ctx.fillText(d.mejor.nombre, cx, cy + 170);
    ctx.fillStyle = GRIS;
    ctx.font = "500 40px Inter, system-ui, sans-serif";
    ctx.fillText(`${d.mejor.puntos} puntos${d.mejor.iglesia ? ` · ${d.mejor.iglesia}` : ""}`, cx, cy + 230);
  }

  ctx.fillStyle = ORO;
  ctx.font = "600 44px Inter, system-ui, sans-serif";
  ctx.fillText("Juega en elimlldm.net/juegos/liga", ANCHO / 2, ALTO - 120);
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
      {!datos.mejor && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          El mejor jugador no sale porque no marcó la casilla de permiso (o nadie ha jugado).
        </p>
      )}
      <button type="button" disabled={!listo} onClick={descargar} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold disabled:opacity-60" style={{ background: "var(--color-primary)", color: "#000" }}>
        <Download size={16} /> Descargar imagen (PNG)
      </button>
    </div>
  );
}
```

Antes de usar `fotoDesdeServidor`, confirmar que `src/lib/palabra/video/recursos.ts` no tiene `"server-only"` y que lo exporta: `grep -n "server-only\|export const fotoDesdeServidor" src/lib/palabra/video/recursos.ts`. Si el archivo arrastrara demasiado al cliente, copiar la línea: `const fotoDesdeServidor = (avatar: string) => \`/api/admin/palabra/tiktok/foto?url=${encodeURIComponent(avatar)}\`;`.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit` → sin errores.

- [ ] **Step 3: Commit (Tasks 12 y 13)**

```bash
git add src/app/admin/liga src/components/admin/liga src/components/layout/AdminSidebar.tsx
git commit -m "Liga: admin de iglesias y tarjeta para TikTok"
```

---

### Task 14: Aplicar la migración y verificar

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: termina sin errores.

- [ ] **Step 2: Pedir autorización al usuario** para aplicar `0086_liga_iglesias.sql` en el SQL Editor de Supabase. Con su "sí", aplicarla con Claude en Chrome usando su sesión, como en migraciones anteriores.

- [ ] **Step 3: Revisar la base** con la REST API y la service role key de `.env.local`:
  - `iglesias` tiene 4 filas aprobadas;
  - los perfiles con `iglesia` = Riverside, Guadalajara, "Santa Lucia, Campeche" y "Cdmx, Magdalena" tienen `iglesia_id`;
  - con la anon key, `GET /rest/v1/liga_puntos` responde 401 o 403 (permiso denegado);
  - con la anon key, un `PATCH /rest/v1/profiles` de `iglesia_id` falla (trigger).

- [ ] **Step 4: Probar en local** (`npm run dev` en el puerto 3100, que usa la base de producción), con la cuenta del usuario en Chrome:
  1. En /juegos/palabra aparece el aviso; buscar "Guadalajara" y elegirla; el aviso no vuelve.
  2. En /juegos/liga aparece "La Iglesia de Guadalajara…" y el botón "Invitar a mis hermanos".
  3. Llamar a `registrarPuntosLiga` 3 veces seguidas con la misma `eventoRef` (desde un script temporal en el scratchpad con service role): queda una sola fila.
  4. Tope: registrar 50 puntos de ahorcado con eventos distintos: el total del día no pasa de 40.
  5. `GET /api/cron/liga-cierre` con `Authorization: Bearer $CRON_SECRET`: responde `{ semana, guardada }`; la segunda vez, `guardada: false`.
  6. /admin/liga muestra pendientes y aprobadas, y la tarjeta se dibuja y descarga.
  7. Volver a jugar cada uno de los 4 juegos un momento: funcionan igual.
  8. Sesión cerrada: al terminar Palabra del Día sale "¿Quieres que tus puntos sumen…".
  9. Borrar las filas de prueba de `liga_puntos` y `liga_campeonas` que se crearon en los pasos 3 a 5.

- [ ] **Step 5: Avisar al usuario** del resultado y preguntar si se pasa a master y se publica.

---

## Self-review

- **Cobertura del diseño:**
  - §1 Iglesias: Tasks 1, 2, 5 y 12.
  - §2 Elegir: Tasks 5, 6 y 9.
  - §3 Puntos: Tasks 1, 2 y 3.
  - §4 Sin sesión: Task 8.
  - §5 Página: Task 7.
  - §6 Cron: Task 11.
  - §7 Admin: Tasks 12 y 13.
  - §8 Casilla: Task 10.
  - §9 Migración: Tasks 1 y 14.
  - §11 Pruebas: Task 14.
- **Agregados que no estaban en el diseño:**
  - Trigger `profiles_proteger_liga`: sin él, cualquiera podía cambiar su `iglesia_id` por REST y saltarse los 30 días.
  - El ranking de Palabra usa la tabla nueva para que no queden dos sistemas de iglesia.
- **Tipos:** `IglesiaElegida`, `TablaLiga`, `MiIglesiaLiga`, `DatosTarjetaLiga` y `JuegoLiga` se usan con los mismos nombres en todas las tareas.
