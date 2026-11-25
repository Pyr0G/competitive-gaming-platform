CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 3 AND 32),
  name_key TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL CHECK(length(tag) BETWEEN 2 AND 5),
  tag_key TEXT NOT NULL UNIQUE,
  captain_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX teams_created ON teams(created_at DESC, id DESC);
CREATE INDEX teams_captain ON teams(captain_id);

CREATE TABLE team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK(role IN ('captain', 'member')),
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY(team_id, user_id)
);
CREATE INDEX team_members_user ON team_members(user_id);
