-- ============================================================
-- Elim LLDM — Notificaciones push: "alguien se conectó, listo para jugar"
-- Ejecutar con `supabase db push`
--
-- Cuando alguien de la lista de /juegos/jugadores se conecta, el resto de
-- la lista que haya activado notificaciones recibe un push del navegador
-- ("¡Fulano se conectó! ¿Vamos a jugar?"). No usa Meta Business/WhatsApp
-- — son Web Push nativas del navegador, con llaves VAPID (.env.local).
-- ============================================================

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_insert_own" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_select_own" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
-- UPDATE hace falta para el upsert por "endpoint" en /api/push/subscribe
-- (mismo navegador re-suscribiéndose pisa su fila en vez de duplicarla).
CREATE POLICY "push_subscriptions_update_own" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_delete_own" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
-- Sin policy pública más amplia a propósito — el envío real lee TODAS las
-- suscripciones desde /api/juegos/jugadores/notify-online con el service
-- role (bypassea RLS), nunca desde el navegador de otro usuario.

GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;

-- Para no re-notificar en cada recarga de página de la misma visita —
-- solo se vuelve a avisar de este usuario si pasaron más de 30 minutos
-- desde el último aviso.
ALTER TABLE jugadores_en_linea
  ADD COLUMN last_online_notified_at TIMESTAMPTZ;
