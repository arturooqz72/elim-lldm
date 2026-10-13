-- ============================================================
-- Elim LLDM — permiso para aparecer en los videos de TikTok
--
-- Casilla "Acepto que mi nombre y foto aparezcan en los videos de
-- Elim LLDM en TikTok" (después de resolver la Palabra del Día y en
-- /perfil). Desmarcada por defecto: nadie aparece con nombre y foto en
-- la tarjeta de /admin/palabra/tiktok sin haberla marcado; los demás
-- salen como "Hermano/a participante", sin foto y sin iglesia.
--
-- Solo agrega dos columnas. Siguiendo 0076, anon y authenticated no
-- pueden leerlas (su GRANT de SELECT es por columnas y estas no van):
-- las lee y las cambia el servidor con service role
-- (/api/cuenta/tiktok, getProfile, la tarjeta de admin).
-- tiktok_permiso_at guarda cuándo la marcó o desmarcó por última vez.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tiktok_permiso BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tiktok_permiso_at TIMESTAMPTZ;
