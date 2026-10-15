-- ============================================================
-- Elim LLDM — Elim English: recordatorio diario (Web Push) y eventos
-- Correr en Supabase → SQL Editor (proyecto de producción).
--
-- Tres tablas nuevas, todas con RLS activo y SIN políticas, y además sin
-- permisos para anon/authenticated (REVOKE): el navegador no puede leerlas
-- ni escribirlas; solo el servidor (service role) desde las rutas /api/ingles/*. No toca push_subscriptions (los avisos de los
-- juegos siguen igual) ni nada de cobros o del límite de mensajes.
-- ============================================================

-- 1) Suscripciones al recordatorio de inglés (una por navegador/teléfono).
--    Aparte de push_subscriptions: esa es de los juegos, con el service
--    worker del sitio; esta usa el de la app de inglés (/ingles-sw.js).
CREATE TABLE english_push_suscripciones (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  -- Zona horaria del teléfono (ej. "America/Mexico_City"), para mandar
  -- algún día a las 6 pm de cada quien. Hoy el envío es a las 6 pm del Pacífico.
  zona_horaria  TEXT,
  plataforma    TEXT NOT NULL DEFAULT 'otro' CHECK (plataforma IN ('ios', 'android', 'otro')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_english_push_suscripciones_user ON english_push_suscripciones (user_id);

ALTER TABLE english_push_suscripciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON english_push_suscripciones FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON english_push_suscripciones TO service_role;

-- 2) Recordatorios enviados: máximo uno por persona al día (día del Pacífico).
--    abierto_at se llena cuando abre la app tocando la notificación.
CREATE TABLE english_push_envios (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dia         DATE NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('reto', 'racha')),
  entregados  INT NOT NULL DEFAULT 0,
  abierto_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dia)
);

CREATE INDEX idx_english_push_envios_dia ON english_push_envios (dia);

ALTER TABLE english_push_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON english_push_envios FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON english_push_envios TO service_role;

-- 3) Eventos para las estadísticas: botones de respuesta rápida y la
--    respuesta al aviso "¿Quieres que te recuerde…?". Con o sin cuenta.
CREATE TABLE english_eventos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  visitante_id  UUID,
  tipo          TEXT NOT NULL CHECK (tipo IN ('boton_rapido', 'aviso_push')),
  -- boton_rapido: 'pronunciacion' | 'platicar' | 'reto' | 'principiante'
  -- aviso_push:   'si' | 'ahora_no' | 'bloqueado' (dijo Sí y el navegador negó) | 'apagado'
  valor         TEXT NOT NULL,
  CHECK (user_id IS NOT NULL OR visitante_id IS NOT NULL)
);

CREATE INDEX idx_english_eventos_fecha ON english_eventos (created_at);

ALTER TABLE english_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON english_eventos FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON english_eventos TO service_role;
