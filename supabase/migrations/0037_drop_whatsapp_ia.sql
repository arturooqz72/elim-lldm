-- ============================================================
-- Elim LLDM — Revertir el asistente de WhatsApp (0036_whatsapp_ia.sql)
--
-- El bot de WhatsApp no era lo que se buscaba (contestaba siempre y
-- requería un número aparte, en vez de ser un respaldo del número de
-- contacto ya existente cuando el administrador no puede contestar).
-- Se retiró el código (whatsapp-bot/, src/app/api/whatsapp/) y esta
-- migración retira la tabla que quedó sin usar. No tenía datos reales
-- de ningún visitante, solo mensajes de prueba.
-- ============================================================

DROP TABLE IF EXISTS whatsapp_ia_messages;
