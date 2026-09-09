-- ============================================================
-- Elim LLDM — Aviso "listo para jugar" por juego (reemplaza al genérico)
-- Ejecutar con `supabase db push`
--
-- Reemplaza el aviso de 0032 ("alguien se conectó al sitio", sin decir a
-- qué juego) por uno específico por juego: quien active la campana de una
-- puerta recibe un push solo cuando alguien entra al lobby de ESE juego y
-- todavía hace falta gente para arrancar.
--
-- game_key usa los mismos valores que ya existen en tabla_posiciones
-- (0029): 'arena_abierta', 'ruleta' — un juego nuevo solo necesita un
-- game_key nuevo, sin inventar convenciones distintas por sistema.
-- ============================================================

CREATE TABLE game_notify_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, game_key)
);

CREATE INDEX idx_game_notify_subscriptions_game ON game_notify_subscriptions(game_key);

ALTER TABLE game_notify_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_notify_subscriptions_insert_own" ON game_notify_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "game_notify_subscriptions_select_own" ON game_notify_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
-- UPDATE hace falta para el upsert por (user_id, game_key) en
-- /api/juegos/[gameKey]/notify-subscribe — mismo motivo que
-- push_subscriptions_update_own en 0032.
CREATE POLICY "game_notify_subscriptions_update_own" ON game_notify_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "game_notify_subscriptions_delete_own" ON game_notify_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
-- Sin policy pública más amplia — el envío real lee TODAS las
-- suscripciones de un game_key desde notify-waiting.server.ts con el
-- service role (bypasea RLS), nunca desde el navegador de otro usuario.

GRANT SELECT, INSERT, UPDATE, DELETE ON game_notify_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON game_notify_subscriptions TO authenticated;
