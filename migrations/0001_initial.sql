CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL CHECK(length(username) BETWEEN 3 AND 24),
  username_key TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL CHECK(length(email) <= 254),
  email_key TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '' CHECK(length(bio) <= 500),
  language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('en', 'pl')),
  locale TEXT NOT NULL DEFAULT 'en-GB',
  time_zone TEXT NOT NULL DEFAULT 'UTC',
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0, 1)),
  banned_at TEXT,
  ban_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits(reset_at);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_low TEXT NOT NULL REFERENCES users(id),
  user_high TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK(user_low < user_high),
  UNIQUE(user_low, user_high)
);
CREATE INDEX conversations_high ON conversations(user_high);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(conversation_id, sender_id, client_id)
);
CREATE INDEX messages_conversation ON messages(conversation_id, id);

CREATE TABLE conversation_reads (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  last_message_id INTEGER NOT NULL DEFAULT 0 CHECK(last_message_id >= 0),
  PRIMARY KEY(user_id, conversation_id)
);

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK(blocker_id <> blocked_id),
  PRIMARY KEY(blocker_id, blocked_id)
);
CREATE INDEX blocks_target ON blocks(blocked_id);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  reported_user_id TEXT NOT NULL REFERENCES users(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  message_id INTEGER NOT NULL REFERENCES messages(id),
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 1000),
  evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json)),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
  resolution TEXT,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(reporter_id, message_id)
);
CREATE INDEX reports_status ON reports(status, created_at, id);

CREATE TABLE admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT REFERENCES users(id),
  report_id TEXT REFERENCES reports(id),
  action TEXT NOT NULL CHECK(action IN ('ban', 'unban', 'resolve_report')),
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
