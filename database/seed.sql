INSERT INTO users (nick, password_hash, faceit_player_id, faceit_nick, faceit_level, preferred_role, availability, bio, is_admin)
SELECT v.nick,
       '$2b$10$JV5sLWpfUjO9Qd/3V/kUhOOaJPCbdbt9va..t/09IedlQ8nPM5BzS',
       CASE WHEN v.faceit_nick IS NULL THEN NULL ELSE gen_random_uuid()::text END,
       v.faceit_nick,
       v.faceit_level,
       v.preferred_role::player_role,
       v.availability,
       v.bio,
       v.is_admin
FROM (VALUES
    ('Admin',    NULL,            NULL, NULL,      NULL,                     'Organizator turniejów', TRUE),
    ('Bartek',   'bartek_igl',    8,    'igl',     'wieczory',               'Kapitan Ekipy z Akademika', FALSE),
    ('Wiktor',   'wiktor_awp',    9,    'awp',     'wieczory',               NULL, FALSE),
    ('Łukasz',   'lukasz_entry',  7,    'entry',   'weekendy',               NULL, FALSE),
    ('Paweł',    'pawel_supp',    6,    'support', 'wieczory',               NULL, FALSE),
    ('Michał',   'michal_flex',   7,    'flex',    'wieczory i weekendy',    NULL, FALSE),
    ('Grzesiek', 'grzesiek_rez',  6,    'flex',    'weekendy',               'Rezerwowy, wchodzę jak trzeba', FALSE),
    ('Kacper',   'kacper_cbs',    6,    'igl',     'wieczory',               'Kapitan Cebulowych Smoków', FALSE),
    ('Szymon',   'szymon_awp',    7,    'awp',     'wieczory',               NULL, FALSE),
    ('Dawid',    'dawid_entry',   5,    'entry',   'weekendy',               NULL, FALSE),
    ('Mateusz',  'mateusz_s',     5,    'support', 'wieczory',               NULL, FALSE),
    ('Filip',    'filip_flex',    6,    'flex',    'weekendy',               NULL, FALSE),
    ('Oliwia',   'oliwia_igl',    7,    'igl',     'wieczory',               'Kapitanka Nocnych Marków', FALSE),
    ('Julia',    'julia_awp',     8,    'awp',     'noce',                   NULL, FALSE),
    ('Natalia',  'natalia_e',     6,    'entry',   'noce',                   NULL, FALSE),
    ('Zosia',    'zosia_supp',    5,    'support', 'noce',                   NULL, FALSE),
    ('Maja',     'maja_flex',     6,    'flex',    'wieczory',               NULL, FALSE),
    ('Krystian', 'krystian_sgm',  9,    'igl',     'wieczory',               'Kapitan Sigma Squad', FALSE),
    ('Adrian',   'adrian_awp',    10,   'awp',     'wieczory',               NULL, FALSE),
    ('Patryk',   'patryk_entry',  8,    'entry',   'wieczory',               NULL, FALSE),
    ('Hubert',   'hubert_supp',   7,    'support', 'weekendy',               NULL, FALSE),
    ('Igor',     'igor_flex',     8,    'flex',    'wieczory',               NULL, FALSE),
    ('Tomek',    'tomek_pls',     6,    'igl',     'wieczory po 19',         'Kapitan, brakuje nam jednej osoby', FALSE),
    ('Jakub',    'jakub_awp',     7,    'awp',     'wieczory po 19',         NULL, FALSE),
    ('Marcel',   'marcel_supp',   5,    'support', 'weekendy',               NULL, FALSE),
    ('Oskar',    'oskar_flex',    6,    'flex',    'wieczory',               NULL, FALSE),
    ('Kuba',     'kuba_entry',    7,    'entry',   'wieczory po 19, weekendy', 'Gram entry, szukam ekipy na turnieje', FALSE),
    ('Ola',      'ola_supp',      4,    'support', 'weekendy',               'Dopiero zaczynam turnieje', FALSE)
) AS v (nick, faceit_nick, faceit_level, preferred_role, availability, bio, is_admin);

INSERT INTO teams (name, tag, captain_id, invite_code, recruitment_open)
SELECT v.name, v.tag, u.id, v.invite_code, v.recruitment_open
FROM (VALUES
    ('Ekipa z Akademika', 'AKD', 'Bartek',   'AKD7Q2', FALSE),
    ('Cebulowe Smoki',    'CBS', 'Kacper',   'CBS4M9', FALSE),
    ('Nocne Marki',       'NCM', 'Oliwia',   'NCM8K1', FALSE),
    ('Sigma Squad',       'SGM', 'Krystian', 'SGM3P6', FALSE),
    ('Pół Składu',        'PLS', 'Tomek',    'PLS5X8', TRUE)
) AS v (name, tag, captain_nick, invite_code, recruitment_open)
JOIN users u ON u.nick = v.captain_nick;

INSERT INTO team_members (team_id, user_id, is_substitute)
SELECT t.id, u.id, v.is_substitute
FROM (VALUES
    ('AKD', 'Bartek', FALSE), ('AKD', 'Wiktor', FALSE), ('AKD', 'Łukasz', FALSE), ('AKD', 'Paweł', FALSE), ('AKD', 'Michał', FALSE), ('AKD', 'Grzesiek', TRUE),
    ('CBS', 'Kacper', FALSE), ('CBS', 'Szymon', FALSE), ('CBS', 'Dawid', FALSE), ('CBS', 'Mateusz', FALSE), ('CBS', 'Filip', FALSE),
    ('NCM', 'Oliwia', FALSE), ('NCM', 'Julia', FALSE), ('NCM', 'Natalia', FALSE), ('NCM', 'Zosia', FALSE), ('NCM', 'Maja', FALSE),
    ('SGM', 'Krystian', FALSE), ('SGM', 'Adrian', FALSE), ('SGM', 'Patryk', FALSE), ('SGM', 'Hubert', FALSE), ('SGM', 'Igor', FALSE),
    ('PLS', 'Tomek', FALSE), ('PLS', 'Jakub', FALSE), ('PLS', 'Marcel', FALSE), ('PLS', 'Oskar', FALSE)
) AS v (tag, nick, is_substitute)
JOIN teams t ON t.tag = v.tag
JOIN users u ON u.nick = v.nick;

INSERT INTO advertisements (author_id, team_id, type, faceit_level, role, availability, language, description, created_at, expires_at, is_closed)
SELECT u.id, t.id, v.type::ad_type, v.faceit_level, v.role::player_role, v.availability, 'polski', v.description,
       NOW() - v.age, NOW() - v.age + INTERVAL '7 days', v.is_closed
FROM (VALUES
    ('Kuba',   NULL,  'lfc', 7, 'entry',   'wieczory po 19, weekendy', 'Szukam ekipy na turnieje, gram entry. Mam mikrofon i ogarniam callouty.', INTERVAL '1 day',  FALSE),
    ('Ola',    NULL,  'lfc', 4, 'support', 'weekendy',                 'Szukam luźnej drużyny, chcę zagrać pierwszy turniej.',                 INTERVAL '3 days', FALSE),
    ('Tomek',  'PLS', 'lfm', 6, 'entry',   'wieczory po 19',           'Brakuje nam entry fraggera, FACEIT 6 lub wyżej. Gramy na spokojnie.',  INTERVAL '2 hours', FALSE),
    ('Kacper', 'CBS', 'lfm', 5, 'flex',    'wieczory',                 'Szukaliśmy piątego, już mamy.',                                        INTERVAL '10 days', TRUE)
) AS v (author_nick, team_tag, type, faceit_level, role, availability, description, age, is_closed)
JOIN users u ON u.nick = v.author_nick
LEFT JOIN teams t ON t.tag = v.team_tag;

INSERT INTO conversations (user_a_id, user_b_id)
SELECT LEAST(a.id, b.id), GREATEST(a.id, b.id)
FROM users a, users b
WHERE a.nick = 'Tomek' AND b.nick = 'Kuba';

INSERT INTO messages (conversation_id, sender_id, content, sent_at, read_at)
SELECT c.id, u.id, v.content, NOW() - v.ago, CASE WHEN v.is_read THEN NOW() - v.ago + INTERVAL '1 minute' END
FROM (VALUES
    ('Tomek', 'Siema, widziałem Twoje ogłoszenie. Szukamy entry na Puchar Akademika, wchodzisz?', INTERVAL '50 minutes', TRUE),
    ('Kuba',  'Hej, pewnie. Kiedy gracie?',                                                       INTERVAL '45 minutes', TRUE),
    ('Tomek', 'Zwykle wieczorami po 19. Masz kod do drużyny: PLS5X8',                              INTERVAL '40 minutes', TRUE),
    ('Kuba',  'Dzięki, zaraz wpisuję',                                                            INTERVAL '5 minutes',  FALSE)
) AS v (sender_nick, content, ago, is_read)
JOIN users u ON u.nick = v.sender_nick
CROSS JOIN conversations c;

INSERT INTO user_blocks (blocker_id, blocked_id)
SELECT a.id, b.id FROM users a, users b WHERE a.nick = 'Ola' AND b.nick = 'Mateusz';

INSERT INTO user_reports (reporter_id, reported_id, reason)
SELECT a.id, b.id, 'Spamuje linkami na czacie' FROM users a, users b WHERE a.nick = 'Ola' AND b.nick = 'Mateusz';

INSERT INTO tournaments (name, max_teams, format, rules, status, registration_closes_at, starts_at, created_by)
SELECT v.name, v.max_teams, v.format::match_format, v.rules, v.status::tournament_status, v.closes_at::timestamptz, v.starts_at::timestamptz, u.id
FROM (VALUES
    ('Puchar Akademika #1', 8,  'bo1', 'Mapy wybieramy przez banowanie. 15 minut spóźnienia to walkower.', 'in_progress',  '2026-10-20 18:00+02', '2026-10-24 18:00+02'),
    ('Nocny Turniej BO3',   16, 'bo3', 'Półfinały i finał w BO3, reszta też BO3.',                         'registration', '2026-11-14 18:00+01', '2026-11-15 18:00+01')
) AS v (name, max_teams, format, rules, status, closes_at, starts_at)
JOIN users u ON u.nick = 'Admin';

INSERT INTO tournament_teams (tournament_id, team_id)
SELECT tr.id, t.id
FROM (VALUES
    ('Puchar Akademika #1', 'AKD'), ('Puchar Akademika #1', 'CBS'), ('Puchar Akademika #1', 'NCM'), ('Puchar Akademika #1', 'SGM'),
    ('Nocny Turniej BO3', 'NCM')
) AS v (tournament_name, tag)
JOIN tournaments tr ON tr.name = v.tournament_name
JOIN teams t ON t.tag = v.tag;

INSERT INTO tournament_players (tournament_id, team_id, user_id, is_substitute)
SELECT tt.tournament_id, tt.team_id, tm.user_id, tm.is_substitute
FROM tournament_teams tt
JOIN team_members tm ON tm.team_id = tt.team_id;

INSERT INTO matches (tournament_id, round, position, team1_id, status)
SELECT tr.id, 2, 1, t.id, 'scheduled'
FROM tournaments tr, teams t
WHERE tr.name = 'Puchar Akademika #1' AND t.tag = 'AKD';

INSERT INTO matches (tournament_id, round, position, next_match_id, team1_id, team2_id, winner_id, team1_score, team2_score, faceit_match_id, status, finished_at)
SELECT tr.id, 1, 1, f.id, a.id, b.id, a.id, 13, 8, '1-8f3c2a71-4b6e-4d2a-9c11-2e7f5d9a0b43', 'finished', '2026-10-24 19:12+02'
FROM tournaments tr
JOIN matches f ON f.tournament_id = tr.id AND f.round = 2
JOIN teams a ON a.tag = 'AKD'
JOIN teams b ON b.tag = 'CBS'
WHERE tr.name = 'Puchar Akademika #1';

INSERT INTO matches (tournament_id, round, position, next_match_id, team1_id, team2_id, status)
SELECT tr.id, 1, 2, f.id, a.id, b.id, 'awaiting_result'
FROM tournaments tr
JOIN matches f ON f.tournament_id = tr.id AND f.round = 2
JOIN teams a ON a.tag = 'NCM'
JOIN teams b ON b.tag = 'SGM'
WHERE tr.name = 'Puchar Akademika #1';
