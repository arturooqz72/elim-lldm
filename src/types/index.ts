export type Role = "admin" | "anfitrion" | "participante" | "moderador" | "super_moderador" | "oyente_plus";

export type PláticaStatus = "scheduled" | "backstage" | "live" | "ended";

export type StageLayout = "solo" | "lado_a_lado" | "grid" | "pantalla";

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

export interface Sugerencia {
  id: string;
  nombre: string;
  correo: string;
  mensaje: string;
  created_at: string;
}

export interface Saludo {
  id: string;
  nombre: string;
  audio_path: string;
  duration_seconds: number;
  contacto: string | null;
  platika_id: string | null;
  played_at: string | null;
  created_at: string;
}

export interface Pláticas {
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  status: PláticaStatus;
  livekit_room_name: string | null;
  radio_output_active: boolean;
  stage_layout: StageLayout;
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
  dificultad: "facil" | "normal" | "dificil" | null;
  categoria: string | null;
  activa: boolean;
  estado: "aprobada" | "pendiente" | "rechazada";
  origen: "manual" | "banco_inicial" | "generada";
  veces_respondida: number;
  veces_acertada: number;
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
  modo: "propias" | "banco";
  total_preguntas: number | null;
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
  user_id: string | null;
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

// ── La Ruleta en línea (multijugador con código de sala) ───────────────────────

export type RuletaStatus = "lobby" | "playing" | "ronda_fin" | "finished";

export interface RuletaSala {
  id: string;
  codigo: string;
  status: RuletaStatus;
  rondas_totales: number;
  ronda_actual: number;
  jugadores_deseados: number;
  turno_jugador_id: string | null;
  turno_termina_en: string | null;
  ronda_fin_termina_en: string | null;
  giro_usado: boolean;
  puede_consonante: boolean;
  valor_giro_actual: number | null;
  frases_usadas: string[];
  ultima_categoria: string | null;
  created_by: string | null;
  created_at: string;
  turnos_saltados_seguidos: number;
}

export interface RuletaJugador {
  id: string;
  sala_id: string;
  nombre: string;
  orden: number;
  puntos: number;
  user_id: string | null;
  created_at: string;
}

export interface RuletaBoardTile {
  type: "letter" | "space";
  char: string | null;
}

export interface Opinion {
  id: string;
  user_id: string;
  mensaje: string;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}


export type JuegoConTabla = "arena_abierta" | "ruleta";

export interface FilaPosicion {
  user_id: string;
  nombre: string;
  avatar_url: string | null;
  puntos_totales: number;
  partidas: number;
}

export type AhorcadoCategoria = "personaje" | "lugar" | "concepto" | "libro";

export interface AhorcadoPalabra {
  id: string;
  palabra: string;
  categoria: AhorcadoCategoria;
  pista: string;
  referencia_biblica: string | null;
  activo: boolean;
  created_at: string;
}

export interface Programa {
  id: string;
  nombre: string;
  descripcion: string | null;
  horario_texto: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramaHost {
  id: string;
  programa_id: string;
  user_id: string;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

export interface ProgramaAudio {
  id: string;
  programa_id: string;
  titulo: string;
  audio_url: string;
  orden: number;
  host_id: string | null;
  created_at: string;
}

export interface ProgramaGrabacion {
  id: string;
  programa_id: string;
  platika_id: string | null;
  titulo: string;
  audio_url: string;
  b2_file_name: string;
  duration_seconds: number | null;
  started_at: string;
  ended_at: string;
  expires_at: string;
  created_at: string;
}

// ── Destinos múltiples de transmisión ──────────────────────────────────────────

export type DestinoPlataforma = "youtube" | "facebook" | "tiktok" | "otro";

export interface Destino {
  id: string;
  nombre: string;
  plataforma: DestinoPlataforma;
  rtmp_url: string;
  activo: boolean;
  created_at: string;
}

export interface DestinoConEstado {
  id: string;
  nombre: string;
  plataforma: DestinoPlataforma;
  rtmp_url: string;
  isActive: boolean;
  egresoId: string | null;
  // true si viene de un canal de YouTube conectado por OAuth — la URL
  // y el stream key son manejados por Google, no se editan a mano.
  isYoutubeOAuth: boolean;
}

// ---------- Palabra del Día (/juegos/palabra) ----------

/** correct = verde (en su lugar), present = amarillo (en otra posición), absent = gris. */
export type PalabraColor = "correct" | "present" | "absent";

/** Primera pista, visible desde el inicio. */
export type PalabraCategoria = "persona" | "lugar" | "objeto" | "accion" | "concepto";

export interface PalabraIntento {
  /** Ya normalizada: mayúsculas, sin acentos, con Ñ. */
  palabra: string;
  colores: PalabraColor[];
}

/** Lo que se revela solo al terminar la partida. */
export interface PalabraRevelada {
  palabra: string;
  explicacion: string;
  referencia: string;
  /** Libro y capítulo donde aparece la palabra (la segunda pista). */
  libro: string;
  capitulo: number;
}

export interface PalabraPartidaEstado {
  intentos: PalabraIntento[];
  terminada: boolean;
  resuelta: boolean;
  /** Pidió la pista del sistema anterior (solo historial; ya no resta puntos). */
  pistaUsada: boolean;
}

export interface PalabraRacha {
  actual: number;
  maxima: number;
  comodines: number;
  ultimaFecha: string | null;
}

export interface PalabraEstadisticas {
  jugadas: number;
  ganadas: number;
  /** 0-100, redondeado. */
  porcentaje: number;
  /** Índice 0 = resuelta en 1 intento … índice 5 = en 6. */
  distribucion: number[];
}

export interface PalabraEstadoJugador {
  partida: PalabraPartidaEstado | null;
  revelado: PalabraRevelada | null;
  /** Categoría de la palabra de hoy (primera pista, desde el inicio). */
  categoria: PalabraCategoria | null;
  /** "Búscala en Mateo 6": solo después del 2.º intento fallido. */
  pista: string | null;
  racha: PalabraRacha;
  /** Comodines que se gastaron para cubrir días faltados desde la última partida. */
  comodinesUsados: number;
  estadisticas: PalabraEstadisticas;
}

export interface PalabraDiaria {
  id: string;
  fecha: string;
  palabra: string;
  explicacion: string;
  referencia: string;
  categoria: PalabraCategoria;
  libro: string;
  capitulo: number;
  created_at: string;
  updated_at: string;
}

export interface PalabraFilaRankingSemanal {
  user_id: string;
  nombre: string;
  avatar_url: string | null;
  iglesia: string | null;
  puntos: number;
  partidas: number;
}

export interface PalabraFilaRankingRacha {
  user_id: string;
  nombre: string;
  avatar_url: string | null;
  iglesia: string | null;
  actual: number;
  maxima: number;
}

export interface PalabraFilaRankingIglesia {
  iglesia: string;
  puntos: number;
  jugadores: number;
}

// ── Elim English (tutor de inglés con IA, /ingles) ─────────────────────────────

export type InglesNivel = "principiante" | "intermedio" | "avanzado";
export type InglesModo = "conversacion" | "situaciones" | "gramatica" | "vocabulario" | "pronunciacion";
export type InglesSituacion = "restaurante" | "entrevista" | "medico" | "aeropuerto";
export type InglesPaqueteId = "basico" | "grande";

export interface InglesPerfil {
  nivel: InglesNivel;
  modo: InglesModo;
  situacion: InglesSituacion;
}

export interface InglesMensaje {
  /** Id en la base (para practicar con la voz las frases que marcó la tutora). */
  id?: string;
  modo: InglesModo;
  role: "user" | "assistant";
  content: string;
}

/** Lo que le queda al usuario; siempre calculado en el servidor. */
export interface InglesSaldo {
  gratisRestantes: number;
  gratisDiarios: number;
  creditos: number;
  /** Intentos de voz de hoy (contador aparte de los mensajes escritos). */
  vozRestantes: number;
  vozDiarios: number;
}

/** Encuesta "¿Pagarías…?" — solo una encuesta, no es un cobro. */
export type EncuestaTipo = "voz" | "mensajes";
export type EncuestaRespuesta = "no" | "3" | "5" | "10";
export type EncuestasUsuario = Partial<Record<EncuestaTipo, EncuestaRespuesta>>;

/** Paquete tal como se muestra en pantalla (precio ya decidido por el servidor). */
export interface InglesPaquete {
  id: InglesPaqueteId;
  mensajes: number;
  precioCentavos: number;
  moneda: string;
}

// ── Elim English: Reto del día y racha ─────────────────────────────────────────

export interface InglesRetoFrase {
  en: string;
  es: string;
}

/** Reto del día: el mismo para todos, guardado con anticipación. */
export interface InglesReto {
  /** "YYYY-MM-DD" en hora del Pacífico. */
  dia: string;
  titulo: string;
  descripcion: string;
  frases: InglesRetoFrase[];
}

/** Avance del usuario en el reto de hoy. */
export interface InglesRetoAvance {
  completado: boolean;
  /** Mensajes que mandó hoy en el reto. */
  mensajes: number;
  /** Mensajes necesarios para completarlo. */
  requeridos: number;
}

/** Racha de días practicando (completó el reto o mandó al menos 3 mensajes). */
export interface InglesRacha {
  actual: number;
  maxima: number;
  /** Ya cuenta el día de hoy (no se pierde si deja de practicar hoy). */
  hoyCuenta: boolean;
}

// ── Elim English: modo Pronunciación ───────────────────────────────────────────

/** Sonidos difíciles para hispanohablantes que se siguen en el progreso. */
export type InglesSonido = "th" | "v_b" | "sh_ch" | "r" | "vocales" | "s_inicial";

export interface PronFrase {
  id: string;
  texto: string;
  traduccion: string;
  sonido: InglesSonido | null;
}

export interface PronFonema {
  fonema: string;
  puntaje: number;
}

export interface PronPalabra {
  palabra: string;
  puntaje: number;
  /** "None" | "Mispronunciation" | "Omission" | "Insertion" (de Azure) */
  error: string;
  fonemas: PronFonema[];
}

export interface PronResultado {
  puntaje: number;
  precision: number;
  fluidez: number;
  completitud: number;
  palabras: PronPalabra[];
  sonidosFallados: InglesSonido[];
  explicacion: string | null;
}

export interface PronProgreso {
  /** Promedio de los últimos intentos (null si todavía no hay). */
  promedio: number | null;
  intentos: number;
  /** Sonidos que más falla, del más frecuente al menos. */
  sonidosDificiles: { sonido: InglesSonido; veces: number }[];
}
