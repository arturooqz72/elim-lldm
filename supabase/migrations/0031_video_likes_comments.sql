-- ============================================================
-- Elim LLDM — Likes y comentarios en Videos
-- Ejecutar con `supabase db push`
--
-- Mismo patrón que `opiniones` (0028): cualquier cuenta puede dar like
-- (insertar/borrar su propia fila) o comentar (insertar); solo el admin
-- puede borrar comentarios ajenos, vía service role — no hay policy de
-- DELETE de comentarios para anon/authenticated a propósito.
-- ============================================================

ALTER TABLE videos
  ADD COLUMN likes_count INT NOT NULL DEFAULT 0;

-- VIDEO LIKES — una fila = un "me gusta" de un usuario a un video.
-- El conteo en videos.likes_count se mantiene con un trigger (abajo), así
-- que el cliente nunca necesita calcular ni mandar el conteo: solo
-- inserta/borra su propia fila y el número se actualiza solo.
CREATE TABLE video_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, user_id)
);

CREATE INDEX idx_video_likes_video ON video_likes(video_id);
CREATE INDEX idx_video_likes_user ON video_likes(user_id);

-- VIDEO COMMENTS
CREATE TABLE video_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mensaje TEXT NOT NULL CHECK (char_length(trim(mensaje)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_video_comments_video ON video_comments(video_id, created_at);

-- ============================================================
-- TRIGGER: mantener videos.likes_count sincronizado
-- ============================================================

CREATE OR REPLACE FUNCTION sync_video_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE videos SET likes_count = likes_count + 1 WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE videos SET likes_count = likes_count - 1 WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER video_likes_sync_count
  AFTER INSERT OR DELETE ON video_likes
  FOR EACH ROW EXECUTE FUNCTION sync_video_likes_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_likes_select_all" ON video_likes FOR SELECT USING (TRUE);
CREATE POLICY "video_likes_insert_own" ON video_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "video_likes_delete_own" ON video_likes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "video_comments_select_all" ON video_comments FOR SELECT USING (TRUE);
CREATE POLICY "video_comments_insert_own" ON video_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Sin policy de DELETE para anon/authenticated — solo el admin borra,
-- desde /api/admin/video-comments/[id] con el service role.

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON video_likes, video_comments TO service_role;
GRANT SELECT ON video_likes, video_comments TO anon, authenticated;
GRANT INSERT, DELETE ON video_likes TO authenticated;
GRANT INSERT ON video_comments TO authenticated;
