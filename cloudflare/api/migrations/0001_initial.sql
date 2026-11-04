PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS prunex_games (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('white_win', 'black_win', 'draw', 'in_progress')),
  human_color TEXT NOT NULL CHECK (human_color IN ('w', 'b')),
  initial_fen TEXT NOT NULL,
  final_fen TEXT NOT NULL,
  pgn TEXT NOT NULL DEFAULT '',
  moves_json TEXT NOT NULL DEFAULT '[]',
  opponent_version TEXT NOT NULL DEFAULT 'Prunex 0.8.0 browser opponent'
);

CREATE INDEX IF NOT EXISTS prunex_games_user_created_idx
  ON prunex_games (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS prunex_game_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL REFERENCES prunex_games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  white_accuracy REAL,
  black_accuracy REAL,
  analysis_json TEXT NOT NULL,
  share_position_memory INTEGER NOT NULL DEFAULT 0 CHECK (share_position_memory IN (0, 1)),
  UNIQUE (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS prunex_reviews_user_idx
  ON prunex_game_reviews (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS prunex_position_memory (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 128),
  game_id TEXT NOT NULL REFERENCES prunex_games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  position_key TEXT NOT NULL CHECK (length(position_key) BETWEEN 10 AND 100),
  side_to_move TEXT NOT NULL CHECK (side_to_move IN ('w', 'b')),
  move_uci TEXT NOT NULL CHECK (move_uci GLOB '[a-h][1-8][a-h][1-8]' OR move_uci GLOB '[a-h][1-8][a-h][1-8][qrbn]'),
  san TEXT NOT NULL CHECK (length(san) BETWEEN 1 AND 16),
  result_for_mover INTEGER NOT NULL CHECK (result_for_mover IN (-1, 0, 1)),
  eval_loss_cp INTEGER NOT NULL CHECK (eval_loss_cp BETWEEN 0 AND 30),
  grade TEXT NOT NULL CHECK (grade IN ('BRILLIANT', 'GREAT', 'BEST', 'EXCELLENT', 'GOOD')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS prunex_memory_lookup_idx
  ON prunex_position_memory (position_key, side_to_move, eval_loss_cp);

CREATE INDEX IF NOT EXISTS prunex_memory_user_idx
  ON prunex_position_memory (user_id);

CREATE TABLE IF NOT EXISTS prunex_mirror_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('game_upsert', 'review_bundle')),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS prunex_mirror_outbox_user_idx
  ON prunex_mirror_outbox (user_id, created_at);

CREATE TABLE IF NOT EXISTS prunex_backup_runs (
  id TEXT PRIMARY KEY NOT NULL,
  backup_key TEXT NOT NULL UNIQUE,
  backup_manifest_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  at_bookmark TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'verified'))
);

CREATE INDEX IF NOT EXISTS prunex_backup_runs_created_idx
  ON prunex_backup_runs (created_at DESC);
