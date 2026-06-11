-- ============================================================
-- Elim LLDM — ElimPlay: tabla de artistas (con foto)
-- Run in Supabase SQL Editor
--
-- Reemplaza el campo de texto libre audio_tracks.artist por una
-- relación a una tabla artists (nombre + foto + bio opcional),
-- para poder mostrar tarjetas de artista y una página por artista
-- en ElimPlay (estilo Spotify).
-- ============================================================

-- ARTISTS
CREATE TABLE artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  photo_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUDIO_TRACKS -> ARTISTS
ALTER TABLE audio_tracks ADD COLUMN artist_id UUID REFERENCES artists(id);
CREATE INDEX idx_audio_tracks_artist ON audio_tracks(artist_id);

-- Backfill: crear un artista por cada nombre distinto ya usado en audio_tracks.artist
INSERT INTO artists (name)
SELECT DISTINCT trim(artist) FROM audio_tracks
WHERE artist IS NOT NULL AND trim(artist) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE audio_tracks
SET artist_id = artists.id
FROM artists
WHERE trim(audio_tracks.artist) = artists.name;

-- El campo de texto libre queda reemplazado por la relación
ALTER TABLE audio_tracks DROP COLUMN artist;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artists_select_all" ON artists
  FOR SELECT USING (TRUE);
CREATE POLICY "artists_insert_admin" ON artists
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "artists_update_admin" ON artists
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "artists_delete_admin" ON artists
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- GRANTS
-- Las tablas nuevas no heredan los GRANTs base de anon/authenticated/
-- service_role (igual que pasó con audio_categories/audio_tracks en
-- 0005) — sin esto, Postgres responde "permission denied" antes de
-- llegar a evaluar RLS.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON artists TO service_role;
GRANT SELECT ON artists TO anon, authenticated;
GRANT INSERT, UPDATE ON artists TO authenticated;

-- ============================================================
-- STORAGE
-- Las fotos de artista se guardan en el bucket existente
-- "audio-tracks" bajo el prefijo "artists/" — ese bucket ya es
-- público para lectura y admin-only para insert/update/delete
-- (políticas creadas en 0004_elimplay.sql), así que no se necesita
-- un bucket ni políticas nuevas.
-- ============================================================
