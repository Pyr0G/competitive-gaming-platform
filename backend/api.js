import { Router } from "express";
import { query } from "./db.js";
import { requireUser } from "./auth.js";
import { limit } from "./resource-limits.js";

export const api = Router();

const STATUS = { in_progress: "live", registration: "open", finished: "done", cancelled: "done" };
const MATCH_STATE = { finished: "done", awaiting_result: "pending", disputed: "pending", ready: "ready", scheduled: "scheduled" };

const when = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

const format = (date) => (date ? when.format(date) : "do ustalenia");

api.get("/health", async (req, res) => {
    await query("SELECT 1");
    res.json({ ok: true });
});

api.get("/tournaments", async (req, res) => {
    const [tournaments, entries, matches, teams] = await Promise.all([
        query(`SELECT id, name, max_teams, format, status, registration_closes_at, starts_at
               FROM tournaments
               ORDER BY array_position(ARRAY['in_progress','registration','finished','cancelled']::tournament_status[], status), starts_at`),
        query(`SELECT tt.tournament_id, t.tag
               FROM tournament_teams tt JOIN teams t ON t.id = tt.team_id
               ORDER BY tt.registered_at, t.tag`),
        query(`SELECT m.tournament_id, m.round, m.position, a.tag AS a, b.tag AS b, w.tag AS winner,
                      m.team1_score, m.team2_score, m.map, m.scheduled_at, m.faceit_match_id, m.status
               FROM matches m
               LEFT JOIN teams a ON a.id = m.team1_id
               LEFT JOIN teams b ON b.id = m.team2_id
               LEFT JOIN teams w ON w.id = m.winner_id
               ORDER BY m.tournament_id, m.round, m.position`),
        query("SELECT tag, name FROM teams ORDER BY tag"),
    ]);

    const list = tournaments.rows.map((t) => {
        const registered = entries.rows.filter((e) => e.tournament_id === t.id).map((e) => e.tag);
        const own = matches.rows.filter((m) => m.tournament_id === t.id);
        const item = {
            id: String(t.id),
            name: t.name,
            status: STATUS[t.status],
            format: t.format.toUpperCase(),
            start: format(t.starts_at),
            slots: t.max_teams,
            teams: registered.length,
        };

        if (!own.length) {
            return { ...item, registered, deadline: t.registration_closes_at.toISOString() };
        }

        const roundCount = Math.max(...own.map((m) => m.round));
        item.rounds = Array.from({ length: roundCount }, (_, i) => own
            .filter((m) => m.round === i + 1)
            .map((m) => ({
                a: m.a,
                b: m.b,
                sa: m.team1_score,
                sb: m.team2_score,
                map: m.map || "Do wyboru",
                time: format(m.scheduled_at),
                state: MATCH_STATE[m.status],
                faceit: m.faceit_match_id,
            })));

        const final = own.find((m) => m.round === roundCount);
        if (t.status === "finished" && final?.winner) item.champion = final.winner;
        return item;
    });

    res.json({ teams: Object.fromEntries(teams.rows.map((t) => [t.tag, t.name])), tournaments: list });
});

api.get("/ads", async (req, res) => {
    const { rows } = await query(
        `SELECT a.id::int, a.type, a.faceit_level, a.role, a.availability, a.description, a.created_at,
                a.author_id = $1 AS mine, u.nick, u.faceit_nick, t.name AS team_name, t.tag AS team_tag, cap.nick AS captain,
                (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND NOT tm.is_substitute)::int AS members
         FROM advertisements a
         JOIN users u ON u.id = a.author_id
         LEFT JOIN teams t ON t.id = a.team_id
         LEFT JOIN users cap ON cap.id = t.captain_id
         WHERE a.is_closed = FALSE AND a.expires_at > NOW()
         ORDER BY a.created_at DESC`,
        [req.userId || 0],
    );
    res.json({ ads: rows });
});

const ROLES = ["entry", "support", "awp", "igl", "flex"];

api.post("/ads", requireUser, limit("ads", 10, 30), async (req, res) => {
    const type = req.body.type === "lfm" ? "lfm" : "lfc";
    const role = ROLES.includes(req.body.role) ? req.body.role : null;
    const level = Number(req.body.level);
    const availability = String(req.body.availability || "").trim().slice(0, 80) || null;
    const description = String(req.body.description || "").trim();

    if (!role) return res.status(400).json({ error: "Wybierz rolę." });
    if (!Number.isInteger(level) || level < 1 || level > 10) return res.status(400).json({ error: "Poziom FACEIT musi być od 1 do 10." });
    if (description.length < 10 || description.length > 500) return res.status(400).json({ error: "Opis musi mieć od 10 do 500 znaków." });

    let teamId = null;
    if (type === "lfm") {
        const { rows } = await query("SELECT id FROM teams WHERE captain_id = $1 LIMIT 1", [req.userId]);
        if (!rows.length) return res.status(400).json({ error: "Szukać gracza do składu może tylko kapitan drużyny." });
        teamId = rows[0].id;
    }

    const { rows: active } = await query(
        "SELECT COUNT(*)::int AS n FROM advertisements WHERE author_id = $1 AND is_closed = FALSE AND expires_at > NOW()",
        [req.userId],
    );
    if (active[0].n >= 3) return res.status(400).json({ error: "Możesz mieć naraz maksymalnie 3 aktywne ogłoszenia." });

    const { rows } = await query(
        `INSERT INTO advertisements (author_id, team_id, type, faceit_level, role, availability, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::int`,
        [req.userId, teamId, type, level, role, availability, description],
    );
    res.status(201).json({ id: rows[0].id });
});

api.delete("/ads/:id", requireUser, async (req, res) => {
    const { rowCount } = await query(
        "UPDATE advertisements SET is_closed = TRUE WHERE id = $1 AND author_id = $2 AND is_closed = FALSE",
        [Number(req.params.id) || 0, req.userId],
    );
    if (!rowCount) return res.status(404).json({ error: "Możesz zamknąć tylko swoje ogłoszenie." });
    res.json({ ok: true });
});
