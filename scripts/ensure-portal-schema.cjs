/**
 * Idempotent schema bootstrap, run once at container startup (see Dockerfile).
 *
 * The production image runs no Drizzle migration step (CMD is just the server),
 * so newer portal tables are created here on deploy. Everything is static
 * `CREATE ... IF NOT EXISTS` DDL — there is no string interpolation or user
 * input, so there is nothing to inject — and it is safe to run on every boot.
 *
 * Failures are logged but never block the server from starting (the app degrades
 * gracefully: solo escape rooms and the rest of the site work without these
 * tables; only co-op needs them).
 *
 * `schema.ts` remains the source of truth; keep these statements in sync with
 * the `escape_sessions` / `escape_session_players` definitions there.
 */
const { Client } = require("pg");

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS escape_sessions (
    id serial PRIMARY KEY,
    code varchar(12) NOT NULL UNIQUE,
    room_slug varchar(255) NOT NULL,
    host_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status varchar(16) NOT NULL DEFAULT 'lobby',
    solved jsonb NOT NULL DEFAULT '[]'::jsonb,
    points integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS escape_sessions_code_idx ON escape_sessions (code)`,
  `CREATE TABLE IF NOT EXISTS escape_session_players (
    id serial PRIMARY KEY,
    session_id integer NOT NULL REFERENCES escape_sessions(id) ON DELETE CASCADE,
    learner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    avatar varchar(16),
    at_station varchar(64),
    joined_at timestamp NOT NULL DEFAULT now(),
    last_seen timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS escape_session_players_uq ON escape_session_players (session_id, learner_id)`,
  `CREATE INDEX IF NOT EXISTS escape_session_players_session_idx ON escape_session_players (session_id)`,
  // Card-game sessions (memory / discard / math). Mirrors card_sessions /
  // card_session_players in schema.ts; full game state lives in `state` jsonb.
  `CREATE TABLE IF NOT EXISTS card_sessions (
    id serial PRIMARY KEY,
    code varchar(12) NOT NULL UNIQUE,
    game_slug varchar(64) NOT NULL,
    mode varchar(16) NOT NULL DEFAULT 'versus',
    host_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status varchar(16) NOT NULL DEFAULT 'lobby',
    state jsonb,
    winners jsonb NOT NULL DEFAULT '[]'::jsonb,
    started_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS card_sessions_code_idx ON card_sessions (code)`,
  `CREATE TABLE IF NOT EXISTS card_session_players (
    id serial PRIMARY KEY,
    session_id integer NOT NULL REFERENCES card_sessions(id) ON DELETE CASCADE,
    learner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    avatar varchar(16),
    joined_at timestamp NOT NULL DEFAULT now(),
    last_seen timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS card_session_players_uq ON card_session_players (session_id, learner_id)`,
  `CREATE INDEX IF NOT EXISTS card_session_players_session_idx ON card_session_players (session_id)`,
];

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[ensure-schema] DATABASE_URL not set; skipping");
    return;
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    for (const stmt of STATEMENTS) await client.query(stmt);
    console.log("[ensure-schema] portal schema ensured");
  } catch (err) {
    console.warn("[ensure-schema] skipped:", err && err.message ? err.message : err);
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
})();
