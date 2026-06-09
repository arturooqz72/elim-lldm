-- ============================================================
-- Elim LLDM — Trivia en Vivo (modo de transmisión vertical)
-- Run in Supabase SQL Editor
--
-- Modo paralelo a /juegos: salas creadas por anfitriones con
-- categoría + dificultad, equipos formados por los jugadores
-- (no predefinidos por el host), pensado para transmitir en
-- formato vertical 9:16 vía OBS.
-- ============================================================

-- TRIVIA ROOMS
CREATE TABLE trivia_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medio'
    CHECK (difficulty IN ('facil', 'medio', 'dificil')),
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'in_progress', 'finished')),
  host_id UUID NOT NULL REFERENCES profiles(id),
  question_set_id UUID NOT NULL REFERENCES question_sets(id),
  current_question_index INT NOT NULL DEFAULT 0,
  join_code TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TRIVIA TEAMS (creados por los jugadores en la sala de espera)
CREATE TABLE trivia_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES trivia_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#f5c842',
  score INT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, name)
);

-- TRIVIA PLAYERS
CREATE TABLE trivia_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES trivia_rooms(id) ON DELETE CASCADE,
  team_id UUID REFERENCES trivia_teams(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id),
  score INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);

-- TRIVIA ANSWERS
CREATE TABLE trivia_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES trivia_rooms(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  player_id UUID NOT NULL REFERENCES trivia_players(id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL CHECK (selected_option IN ('a', 'b', 'c', 'd')),
  is_correct BOOLEAN NOT NULL,
  time_taken_ms INT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, player_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_trivia_rooms_status ON trivia_rooms(status);
CREATE INDEX idx_trivia_rooms_host ON trivia_rooms(host_id);
CREATE INDEX idx_trivia_teams_room ON trivia_teams(room_id);
CREATE INDEX idx_trivia_players_room ON trivia_players(room_id);
CREATE INDEX idx_trivia_answers_room ON trivia_answers(room_id, question_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE trivia_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE trivia_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE trivia_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE trivia_answers ENABLE ROW LEVEL SECURITY;

-- TRIVIA ROOMS (público lee; anfitrión verificado o admin crea; host/admin edita)
CREATE POLICY "trivia_rooms_select_all" ON trivia_rooms
  FOR SELECT USING (TRUE);
CREATE POLICY "trivia_rooms_insert_host" ON trivia_rooms
  FOR INSERT WITH CHECK (
    auth.uid() = host_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'anfitrion') AND verified_lldm = TRUE
    )
  );
CREATE POLICY "trivia_rooms_update_host" ON trivia_rooms
  FOR UPDATE USING (
    auth.uid() = host_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- TRIVIA TEAMS (cualquiera lee; un jugador autenticado crea su propio equipo
-- mientras la sala sigue en lobby — no el host, los jugadores los arman al vuelo)
CREATE POLICY "trivia_teams_select_all" ON trivia_teams
  FOR SELECT USING (TRUE);
CREATE POLICY "trivia_teams_insert_self" ON trivia_teams
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM trivia_rooms
      WHERE trivia_rooms.id = trivia_teams.room_id AND trivia_rooms.status = 'lobby'
    )
  );

-- TRIVIA PLAYERS
CREATE POLICY "trivia_players_select_all" ON trivia_players
  FOR SELECT USING (TRUE);
CREATE POLICY "trivia_players_insert_self" ON trivia_players
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);
CREATE POLICY "trivia_players_update_self" ON trivia_players
  FOR UPDATE USING (auth.uid() = user_id);

-- TRIVIA ANSWERS (el jugador ve las suyas; host/admin ven todas las de su sala)
CREATE POLICY "trivia_answers_select_own_or_host" ON trivia_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trivia_players
      WHERE trivia_players.id = trivia_answers.player_id AND trivia_players.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM trivia_rooms
      WHERE trivia_rooms.id = trivia_answers.room_id AND trivia_rooms.host_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "trivia_answers_insert_self" ON trivia_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trivia_players
      WHERE trivia_players.id = trivia_answers.player_id AND trivia_players.user_id = auth.uid()
    )
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Increment individual player score and propagate to team total
CREATE OR REPLACE FUNCTION increment_trivia_score(
  p_player_id UUID,
  p_points INT
)
RETURNS VOID AS $$
DECLARE
  v_team_id UUID;
BEGIN
  UPDATE trivia_players
  SET score = score + p_points
  WHERE id = p_player_id
  RETURNING team_id INTO v_team_id;

  IF v_team_id IS NOT NULL THEN
    UPDATE trivia_teams
    SET score = score + p_points
    WHERE id = v_team_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
