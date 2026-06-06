-- ============================================================
-- Elim LLDM — Database Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- PROFILES (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'participante'
    CHECK (role IN ('admin', 'anfitrion', 'participante')),
  verified_lldm BOOLEAN NOT NULL DEFAULT FALSE,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- CATEGORIES
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLATIKAS
CREATE TABLE platikas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  host_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'ended')),
  livekit_room_name TEXT UNIQUE,
  radio_output_active BOOLEAN NOT NULL DEFAULT FALSE,
  thumbnail_url TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLATIKAS MESSAGES (chat)
CREATE TABLE platikas_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platikas_id UUID NOT NULL REFERENCES platikas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  is_moderated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLATIKAS REQUESTS (stage queue)
CREATE TABLE platikas_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platikas_id UUID NOT NULL REFERENCES platikas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUESTION SETS
CREATE TABLE question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUESTIONS
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id UUID NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
  bible_reference TEXT,
  time_limit_seconds INT NOT NULL DEFAULT 30,
  points INT NOT NULL DEFAULT 100,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GAMES
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  host_id UUID NOT NULL REFERENCES profiles(id),
  question_set_id UUID NOT NULL REFERENCES question_sets(id),
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'in_progress', 'finished')),
  current_question_index INT NOT NULL DEFAULT 0,
  join_code TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GAME TEAMS
CREATE TABLE game_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#D4A017',
  score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GAME PLAYERS
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id UUID REFERENCES game_teams(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  score INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, user_id)
);

-- GAME ANSWERS
CREATE TABLE game_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  player_id UUID NOT NULL REFERENCES game_players(id),
  selected_option TEXT NOT NULL CHECK (selected_option IN ('a', 'b', 'c', 'd')),
  is_correct BOOLEAN NOT NULL,
  time_taken_ms INT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, player_id)
);

-- ARCHIVE
CREATE TABLE archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platikas_id UUID REFERENCES platikas(id),
  title TEXT NOT NULL,
  description TEXT,
  recording_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INT,
  category_id UUID REFERENCES categories(id),
  tags TEXT[] NOT NULL DEFAULT '{}',
  view_count INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_platikas_status ON platikas(status);
CREATE INDEX idx_platikas_host ON platikas(host_id);
CREATE INDEX idx_platikas_scheduled ON platikas(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_messages_platikas ON platikas_messages(platikas_id, created_at);
CREATE INDEX idx_requests_platikas ON platikas_requests(platikas_id, status);
CREATE INDEX idx_game_players_game ON game_players(game_id);
CREATE INDEX idx_game_answers_game ON game_answers(game_id, question_id);
CREATE INDEX idx_archive_category ON archive(category_id);
CREATE INDEX idx_archive_published ON archive(is_published, published_at DESC);
CREATE INDEX idx_archive_tags ON archive USING gin(tags);
CREATE INDEX idx_games_join_code ON games(join_code);
CREATE INDEX idx_games_status ON games(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE platikas ENABLE ROW LEVEL SECURITY;
ALTER TABLE platikas_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE platikas_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (TRUE);
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- CATEGORIES (public read, admin write)
CREATE POLICY "categories_select_all" ON categories
  FOR SELECT USING (TRUE);
CREATE POLICY "categories_insert_admin" ON categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "categories_update_admin" ON categories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "categories_delete_admin" ON categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- PLATIKAS (public read, anfitrion/admin write)
CREATE POLICY "platikas_select_all" ON platikas
  FOR SELECT USING (TRUE);
CREATE POLICY "platikas_insert_host" ON platikas
  FOR INSERT WITH CHECK (
    auth.uid() = host_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'anfitrion') AND verified_lldm = TRUE
    )
  );
CREATE POLICY "platikas_update_host" ON platikas
  FOR UPDATE USING (
    auth.uid() = host_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- PLATIKAS MESSAGES
CREATE POLICY "messages_select_visible" ON platikas_messages
  FOR SELECT USING (
    is_moderated = FALSE OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion'))
  );
CREATE POLICY "messages_insert_auth" ON platikas_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);
CREATE POLICY "messages_update_admin" ON platikas_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion'))
  );

-- PLATIKAS REQUESTS
CREATE POLICY "requests_select_host_or_owner" ON platikas_requests
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM platikas
      WHERE platikas.id = platikas_requests.platikas_id
      AND (platikas.host_id = auth.uid() OR
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );
CREATE POLICY "requests_insert_auth" ON platikas_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);
CREATE POLICY "requests_update_host" ON platikas_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM platikas
      WHERE platikas.id = platikas_requests.platikas_id
      AND (platikas.host_id = auth.uid() OR
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- QUESTION SETS
CREATE POLICY "question_sets_select" ON question_sets
  FOR SELECT USING (is_public = TRUE OR created_by = auth.uid());
CREATE POLICY "question_sets_insert_admin" ON question_sets
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "question_sets_update_admin" ON question_sets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "question_sets_delete_admin" ON question_sets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- QUESTIONS
CREATE POLICY "questions_select_all" ON questions
  FOR SELECT USING (TRUE);
CREATE POLICY "questions_insert_admin" ON questions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "questions_update_admin" ON questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "questions_delete_admin" ON questions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- GAMES
CREATE POLICY "games_select_all" ON games
  FOR SELECT USING (TRUE);
CREATE POLICY "games_insert_admin" ON games
  FOR INSERT WITH CHECK (
    auth.uid() = host_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion'))
  );
CREATE POLICY "games_update_host" ON games
  FOR UPDATE USING (
    auth.uid() = host_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- GAME TEAMS
CREATE POLICY "game_teams_select_all" ON game_teams
  FOR SELECT USING (TRUE);
CREATE POLICY "game_teams_insert_host" ON game_teams
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM games WHERE games.id = game_teams.game_id AND games.host_id = auth.uid()
    )
  );

-- GAME PLAYERS
CREATE POLICY "game_players_select_all" ON game_players
  FOR SELECT USING (TRUE);
CREATE POLICY "game_players_insert_self" ON game_players
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);
CREATE POLICY "game_players_update_self" ON game_players
  FOR UPDATE USING (auth.uid() = user_id);

-- GAME ANSWERS
CREATE POLICY "game_answers_select_all" ON game_answers
  FOR SELECT USING (TRUE);
CREATE POLICY "game_answers_insert_self" ON game_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.id = game_answers.player_id AND game_players.user_id = auth.uid()
    )
  );

-- ARCHIVE (public read published, admin write)
CREATE POLICY "archive_select_published" ON archive
  FOR SELECT USING (
    is_published = TRUE OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "archive_insert_admin" ON archive
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "archive_update_admin" ON archive
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Atomically increment archive view count
CREATE OR REPLACE FUNCTION increment_view_count(record_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE archive SET view_count = view_count + 1 WHERE id = record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment individual player score and propagate to team total
CREATE OR REPLACE FUNCTION increment_player_score(
  p_player_id UUID,
  p_points INT
)
RETURNS VOID AS $$
DECLARE
  v_team_id UUID;
BEGIN
  UPDATE game_players
  SET score = score + p_points
  WHERE id = p_player_id
  RETURNING team_id INTO v_team_id;

  IF v_team_id IS NOT NULL THEN
    UPDATE game_teams
    SET score = score + p_points
    WHERE id = v_team_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SUPABASE REALTIME — Enable for real-time features
-- ============================================================

-- Enable realtime on tables needed for live subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE platikas_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE platikas_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_teams;

-- ============================================================
-- SEED DATA — Initial categories
-- ============================================================

INSERT INTO categories (name, slug, description, icon, order_index) VALUES
  ('Doctrina', 'doctrina', 'Enseñanzas sobre la doctrina LLDM', 'book-open', 1),
  ('Testimonios', 'testimonios', 'Testimonios de fe y milagros', 'heart', 2),
  ('Profecías', 'profecias', 'Estudios sobre profecías bíblicas', 'scroll', 3),
  ('Himnos y Cánticos', 'himnos', 'Música y cánticos espirituales', 'music', 4),
  ('Evangelismo', 'evangelismo', 'Mensajes de evangelismo', 'globe', 5),
  ('Estudios Bíblicos', 'estudios-biblicos', 'Estudios profundos de la Biblia', 'bible', 6);
