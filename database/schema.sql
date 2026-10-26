CREATE TYPE player_role AS ENUM ('entry', 'support', 'awp', 'igl', 'flex');
CREATE TYPE ad_type AS ENUM ('lfc', 'lfm');
CREATE TYPE match_format AS ENUM ('bo1', 'bo3');
CREATE TYPE tournament_status AS ENUM ('registration', 'in_progress', 'finished', 'cancelled');
CREATE TYPE match_status AS ENUM ('scheduled', 'ready', 'awaiting_result', 'finished', 'disputed');

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nick VARCHAR(32) NOT NULL,
    password_hash TEXT NOT NULL,
    recovery_code_hash TEXT,
    faceit_player_id VARCHAR(64) UNIQUE,
    faceit_nick VARCHAR(64),
    faceit_level SMALLINT CHECK (faceit_level BETWEEN 1 AND 10),
    preferred_role player_role,
    availability TEXT,
    bio VARCHAR(500),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_nick_unique ON users (LOWER(nick));

CREATE TABLE teams (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    tag VARCHAR(4) NOT NULL UNIQUE CHECK (LENGTH(tag) BETWEEN 3 AND 4),
    captain_id BIGINT NOT NULL REFERENCES users (id),
    invite_code VARCHAR(16) NOT NULL UNIQUE,
    recruitment_open BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_members (
    team_id BIGINT NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    is_substitute BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

CREATE TABLE advertisements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    author_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    team_id BIGINT REFERENCES teams (id) ON DELETE CASCADE,
    type ad_type NOT NULL,
    game VARCHAR(32) NOT NULL DEFAULT 'CS2',
    faceit_level SMALLINT CHECK (faceit_level BETWEEN 1 AND 10),
    role player_role,
    availability TEXT,
    language VARCHAR(32),
    description VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK ((type = 'lfm') = (team_id IS NOT NULL))
);

CREATE INDEX advertisements_active ON advertisements (expires_at) WHERE is_closed = FALSE;

CREATE TABLE conversations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_a_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_b_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (user_a_id < user_b_id),
    UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content VARCHAR(2000) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX messages_conversation ON messages (conversation_id, sent_at);

CREATE TABLE user_blocks (
    blocker_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE TABLE user_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporter_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reported_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason VARCHAR(1000) NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tournaments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    game VARCHAR(32) NOT NULL DEFAULT 'CS2',
    max_teams SMALLINT NOT NULL CHECK (max_teams IN (8, 16)),
    format match_format NOT NULL DEFAULT 'bo1',
    rules TEXT,
    status tournament_status NOT NULL DEFAULT 'registration',
    registration_closes_at TIMESTAMPTZ NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    created_by BIGINT NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (registration_closes_at <= starts_at)
);

CREATE TABLE tournament_teams (
    tournament_id BIGINT NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
    team_id BIGINT NOT NULL REFERENCES teams (id),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tournament_id, team_id)
);

CREATE TABLE tournament_players (
    tournament_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users (id),
    is_substitute BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (tournament_id, user_id),
    FOREIGN KEY (tournament_id, team_id) REFERENCES tournament_teams (tournament_id, team_id) ON DELETE CASCADE
);

CREATE TABLE matches (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
    round SMALLINT NOT NULL CHECK (round >= 1),
    position SMALLINT NOT NULL CHECK (position >= 1),
    next_match_id BIGINT REFERENCES matches (id),
    team1_id BIGINT REFERENCES teams (id),
    team2_id BIGINT REFERENCES teams (id),
    winner_id BIGINT REFERENCES teams (id),
    team1_score SMALLINT CHECK (team1_score >= 0),
    team2_score SMALLINT CHECK (team2_score >= 0),
    faceit_match_id VARCHAR(64) UNIQUE,
    status match_status NOT NULL DEFAULT 'scheduled',
    finished_at TIMESTAMPTZ,
    UNIQUE (tournament_id, round, position),
    CHECK (team1_id IS NULL OR team2_id IS NULL OR team1_id <> team2_id),
    CHECK (winner_id IS NULL OR winner_id = team1_id OR winner_id = team2_id),
    CHECK (team1_score IS NULL OR team2_score IS NULL OR team1_score <> team2_score)
);
