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
