-- ============================================================
-- Elim LLDM — ElimPlay (reproductor de audio estilo Spotify)
-- Run in Supabase SQL Editor
--
-- Cantos, Coros, Temas y Testimonios en formato audio,
-- organizados por categoría, con reproductor global persistente.
-- ============================================================

-- AUDIO CATEGORIES
CREATE TABLE audio_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUDIO TRACKS
CREATE TABLE audio_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  description TEXT,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  duration_seconds INT,
  category_id UUID REFERENCES audio_categories(id),
  tags TEXT[] NOT NULL DEFAULT '{}',
  play_count INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_audio_tracks_category ON audio_tracks(category_id);
CREATE INDEX idx_audio_tracks_published ON audio_tracks(is_published, published_at DESC);
CREATE INDEX idx_audio_tracks_tags ON audio_tracks USING gin(tags);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE audio_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_tracks ENABLE ROW LEVEL SECURITY;

-- AUDIO CATEGORIES (public read, admin write)
CREATE POLICY "audio_categories_select_all" ON audio_categories
  FOR SELECT USING (TRUE);
CREATE POLICY "audio_categories_insert_admin" ON audio_categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "audio_categories_update_admin" ON audio_categories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "audio_categories_delete_admin" ON audio_categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- AUDIO TRACKS (public reads published, admin manages all)
CREATE POLICY "audio_tracks_select" ON audio_tracks
  FOR SELECT USING (
    is_published = TRUE
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "audio_tracks_insert_admin" ON audio_tracks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "audio_tracks_update_admin" ON audio_tracks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "audio_tracks_delete_admin" ON audio_tracks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- RPC: increment play_count (callable by anon/authenticated)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_audio_play_count(track_id UUID)
RETURNS VOID AS $$
  UPDATE audio_tracks SET play_count = play_count + 1 WHERE id = track_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION increment_audio_play_count(UUID) TO anon, authenticated;

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-tracks', 'audio-tracks', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "audio_tracks_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio-tracks');

CREATE POLICY "audio_tracks_storage_insert_admin" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'audio-tracks'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "audio_tracks_storage_update_admin" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'audio-tracks'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "audio_tracks_storage_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'audio-tracks'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- SEED DATA — Initial audio categories
-- ============================================================

INSERT INTO audio_categories (name, slug, description, icon, order_index) VALUES
  ('Cantos', 'cantos', 'Himnos y cantos de alabanza', '🎵', 0),
  ('Coros', 'coros', 'Coros congregacionales', '🎶', 1),
  ('Temas', 'temas', 'Temas y enseñanzas en audio', '📖', 2),
  ('Testimonios', 'testimonios', 'Testimonios de fe', '🙏', 3);
