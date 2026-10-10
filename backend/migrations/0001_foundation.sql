-- Reserved D1 schema for authenticated, server-verified competition.
-- Deliberately NOT used by guest practice rooms or local personal bests.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS verified_race_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  prompt_id TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK(duration_ms > 0),
  correct_chars INTEGER NOT NULL CHECK(correct_chars >= 0),
  mistakes INTEGER NOT NULL CHECK(mistakes >= 0),
  finished_at INTEGER NOT NULL,
  validation_version INTEGER NOT NULL,
  UNIQUE(user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_verified_results_user_time
  ON verified_race_results(user_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_verified_results_prompt
  ON verified_race_results(prompt_id, duration_ms);
