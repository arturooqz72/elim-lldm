-- ============================================================
-- Elim LLDM — Videos (subida de usuarios + revisión admin)
-- Run in Supabase SQL Editor
--
-- Cualquier usuario autenticado sube un video (almacenado en
-- Backblaze B2, fuera de Supabase Storage) que queda 'pending'.
-- El admin lo revisa en /admin/videos: aprueba (asigna categoría,
-- pasa a 'approved' y se publica) o rechaza ('rejected').
-- Solo videos 'approved' son visibles públicamente en /videos.
-- ============================================================

-- VIDEO CATEGORIES
CREATE TABLE video_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- VIDEOS
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INT,
  category_id UUID REFERENCES video_categories(id),
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  view_count INT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_videos_category ON videos(category_id);
CREATE INDEX idx_videos_status_published ON videos(status, published_at DESC);
CREATE INDEX idx_videos_tags ON videos USING gin(tags);
CREATE INDEX idx_videos_created_by ON videos(created_by);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE video_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- VIDEO CATEGORIES (public read, admin write)
CREATE POLICY "video_categories_select_all" ON video_categories
  FOR SELECT USING (TRUE);
CREATE POLICY "video_categories_insert_admin" ON video_categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "video_categories_update_admin" ON video_categories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "video_categories_delete_admin" ON video_categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- VIDEOS (public reads approved, owner reads own, admin manages all)
CREATE POLICY "videos_select" ON videos
  FOR SELECT USING (
    status = 'approved'
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "videos_insert_own" ON videos
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND status = 'pending'
  );
CREATE POLICY "videos_update_admin" ON videos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "videos_delete_admin" ON videos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- GRANTS (explícitos en esta misma migración)
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON video_categories, videos TO service_role;
GRANT SELECT ON video_categories TO anon, authenticated;
GRANT SELECT ON videos TO anon, authenticated;
GRANT INSERT ON videos TO authenticated;

-- ============================================================
-- RPC: increment view_count (solo videos aprobados)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_video_view_count(video_id UUID)
RETURNS VOID AS $$
  UPDATE videos SET view_count = view_count + 1
  WHERE id = video_id AND status = 'approved';
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION increment_video_view_count(UUID) TO anon, authenticated;

-- ============================================================
-- STORAGE BUCKET (miniaturas — el video pesado va a Backblaze B2)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('video-thumbnails', 'video-thumbnails', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "video_thumbnails_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'video-thumbnails');

CREATE POLICY "video_thumbnails_storage_insert_auth" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'video-thumbnails' AND auth.role() = 'authenticated'
  );

CREATE POLICY "video_thumbnails_storage_update_admin" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'video-thumbnails'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "video_thumbnails_storage_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'video-thumbnails'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- SEED DATA — Categorías de video
-- ============================================================

INSERT INTO video_categories (name, slug, description, icon, order_index) VALUES
  ('Predicaciones', 'predicaciones', 'Mensajes y predicaciones', '🎙️', 0),
  ('Pláticas', 'platicas', 'Pláticas grabadas', '💬', 1),
  ('Cantos', 'cantos', 'Cantos y alabanzas en video', '🎵', 2),
  ('Testimonios', 'testimonios', 'Testimonios de fe', '✨', 3),
  ('Temas', 'temas', 'Temas y enseñanzas', '📖', 4),
  ('Otros', 'otros', 'Otro contenido', '🎬', 5);
