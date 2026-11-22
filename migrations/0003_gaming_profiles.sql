ALTER TABLE users ADD COLUMN game_role TEXT CHECK(game_role IN ('entry', 'support', 'awp', 'igl', 'flex'));
ALTER TABLE users ADD COLUMN game_level INTEGER CHECK(game_level BETWEEN 1 AND 10);
ALTER TABLE users ADD COLUMN availability TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(availability) AND json_type(availability) = 'array' AND json_array_length(availability) <= 4);
ALTER TABLE users ADD COLUMN spoken_languages TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(spoken_languages) AND json_type(spoken_languages) = 'array' AND json_array_length(spoken_languages) <= 5);
