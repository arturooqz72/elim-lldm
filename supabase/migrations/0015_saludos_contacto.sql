-- ============================================================
-- Elim LLDM — Contacto opcional en saludos (0015)
-- Ejecutar manualmente en Supabase SQL Editor
--
-- Permite a quien graba un saludo dejar un correo o WhatsApp
-- opcional para que el admin pueda escribirle agradeciendo su
-- mensaje desde /admin/saludos. Los saludos ya existentes quedan
-- con contacto = NULL (no hay forma de contactarlos).
-- ============================================================

ALTER TABLE saludos ADD COLUMN contacto TEXT;

ALTER TABLE saludos ADD CONSTRAINT saludos_contacto_length
  CHECK (contacto IS NULL OR char_length(contacto) <= 200);
