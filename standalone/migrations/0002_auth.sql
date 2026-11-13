CREATE TABLE auth_accounts (
 user_id TEXT PRIMARY KEY REFERENCES users(id), username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 1,
 password_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE auth_sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 password_version INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX auth_session_user ON auth_sessions(user_id);
CREATE TABLE auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
ALTER TABLE students ADD COLUMN archived_at TEXT;
