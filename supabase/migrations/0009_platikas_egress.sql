-- ============================================================
-- PLATIKAS — IDs de egress de streaming multiplataforma
-- ============================================================
-- Guardan el egressId de LiveKit cuando una plática se está
-- retransmitiendo a YouTube, Facebook o TikTok, para poder
-- detenerlos automáticamente al terminar la plática.

ALTER TABLE platikas
  ADD COLUMN IF NOT EXISTS youtube_egress_id TEXT,
  ADD COLUMN IF NOT EXISTS facebook_egress_id TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_egress_id TEXT;
