export type Role = "admin" | "anfitrion" | "participante";

export type PláticaStatus = "scheduled" | "live" | "ended";

export type GameStatus = "lobby" | "in_progress" | "finished";

export type RequestStatus = "pending" | "approved" | "rejected" | "completed";

export type AnswerOption = "a" | "b" | "c" | "d";

export type LiveKitRole = "viewer" | "speaker" | "host";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: Role;
  verified_lldm: boolean;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pláticas {
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  status: PláticaStatus;
  livekit_room_name: string | null;
  radio_output_active: boolean;
  thumbnail_url: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  created_at: string;
}

export interface Game {
  id: string;
  title: string;
  host_id: string;
  question_set_id: string;
  status: GameStatus;
  current_question_index: number;
  join_code: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  question_set_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: AnswerOption;
  bible_reference: string | null;
  time_limit_seconds: number;
  points: number;
  order_index: number;
  created_at: string;
}

export interface GameBroadcastEvent {
  type:
    | "QUESTION_START"
    | "QUESTION_END"
    | "SCORES_UPDATE"
    | "GAME_FINISHED"
    | "PLAYER_JOINED";
  payload: Record<string, unknown>;
}

// ── Trivia en Vivo (modo de transmisión vertical 9:16) ─────────────────────────

export type TriviaDifficulty = "facil" | "medio" | "dificil";

export type TriviaStatus = "lobby" | "in_progress" | "finished";

export const TRIVIA_CATEGORIES = [
  "Antiguo Testamento",
  "Nuevo Testamento",
  "Vida de Jesús",
  "Parábolas",
  "Profetas y Reyes",
  "Apocalipsis",
  "Doctrina LLDM",
  "Personajes Bíblicos",
  "General",
] as const;

export type TriviaCategory = (typeof TRIVIA_CATEGORIES)[number];

export const TRIVIA_DIFFICULTY_LABEL: Record<TriviaDifficulty, string> = {
  facil: "Fácil",
  medio: "Medio",
  dificil: "Difícil",
};

export interface TriviaRoom {
  id: string;
  name: string;
  category: string;
  difficulty: TriviaDifficulty;
  status: TriviaStatus;
  host_id: string;
  question_set_id: string;
  current_question_index: number;
  join_code: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface TriviaTeam {
  id: string;
  room_id: string;
  name: string;
  color: string;
  score: number;
  created_by: string;
  created_at: string;
}

export interface TriviaPlayer {
  id: string;
  room_id: string;
  team_id: string | null;
  user_id: string;
  score: number;
  joined_at: string;
}

// ── ElimPlay (reproductor de audio) ─────────────────────────────────────────

export interface AudioCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order_index: number;
  created_at: string;
}

export interface Artist {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface AudioTrack {
  id: string;
  title: string;
  artist_id: string | null;
  description: string | null;
  audio_url: string;
  cover_url: string | null;
  duration_seconds: number | null;
  category_id: string | null;
  tags: string[];
  play_count: number;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  artists?: Artist | null;
}

export type VideoStatus = "pending" | "approved" | "rejected";

export interface VideoCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order_index: number;
  created_at: string;
}

export interface VideoItem {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  category_id: string | null;
  tags: string[];
  status: VideoStatus;
  rejection_reason: string | null;
  view_count: number;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
}

export type ElimIAMode = "lldm" | "general";

export type ElimIARole = "user" | "assistant";

export interface ElimIAMessage {
  id: string;
  user_id: string;
  mode: ElimIAMode;
  role: ElimIARole;
  content: string;
  created_at: string;
}

export interface ElimIADocument {
  id: string;
  title: string;
  file_name: string;
  file_url: string;
  file_type: string;
  content: string;
  created_by: string;
  created_at: string;
}

// ── Elim Arena (trivia multijugador en tiempo real, estilo TikTok) ─────────────

export type ArenaStatus = "lobby" | "playing" | "reveal" | "finished";

export interface ArenaSala {
  id: string;
  codigo: string;
  titulo: string;
  status: ArenaStatus;
  pregunta_actual: number;
  pregunta_termina_en: string | null;
  created_by: string;
  created_at: string;
}

export interface ArenaPregunta {
  id: string;
  sala_id: string;
  pregunta: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  respuesta_correcta: AnswerOption;
  orden: number;
}

export interface ArenaJugador {
  id: string;
  sala_id: string;
  nombre: string;
  puntos: number;
  ultimo_respondido_at: string | null;
  created_at: string;
}

export interface ArenaRespuesta {
  id: string;
  sala_id: string;
  jugador_id: string;
  pregunta_id: string;
  respuesta: AnswerOption;
  es_correcta: boolean;
  tiempo_ms: number;
  created_at: string;
}

export interface ArenaBroadcastEvent {
  type: "QUESTION_START" | "GAME_FINISHED";
  payload: Record<string, unknown>;
}
