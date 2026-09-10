-- ============================================================
-- Elim LLDM — Asistente de WhatsApp (reutiliza la base de
-- conocimiento de Elim IA, modo LLDM)
-- Run in Supabase SQL Editor
--
-- whatsapp_ia_messages: historial de conversación por número de
--   WhatsApp. No hay usuario de Supabase Auth detrás de estos
--   mensajes (quien escribe por WhatsApp no inicia sesión en la
--   plataforma), así que esta tabla es independiente de `profiles`
--   y solo la toca el endpoint interno /api/whatsapp/chat con la
--   service role key.
-- ============================================================

CREATE TABLE whatsapp_ia_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_ia_messages_phone ON whatsapp_ia_messages(phone_number, created_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- RLS activado sin policies para anon/authenticated: nadie desde el
-- cliente puede leer ni escribir aquí. Solo service_role (que
-- ignora RLS) puede hacerlo, y solo el endpoint interno del bot usa
-- esa key.

ALTER TABLE whatsapp_ia_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON whatsapp_ia_messages TO service_role;
