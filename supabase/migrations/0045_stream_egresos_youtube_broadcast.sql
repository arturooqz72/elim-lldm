-- ============================================================
-- Elim LLDM — guarda el broadcast_id de YouTube por egreso
--
-- Necesario para poder llamar transition→complete al detener un
-- destino OAuth de YouTube (mejor esfuerzo — enableAutoStop ya lo
-- haría solo en ~1 min, esto solo lo adelanta).
-- ============================================================

ALTER TABLE platikas_stream_egresos ADD COLUMN youtube_broadcast_id TEXT;
