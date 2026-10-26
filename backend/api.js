import { Router } from "express";
import { query } from "./db.js";

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
        `SELECT a.id, a.type, a.faceit_level, a.role, a.availability, a.description, a.created_at,
                u.nick, u.faceit_nick, t.name AS team_name, t.tag AS team_tag, cap.nick AS captain,
                (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND NOT tm.is_substitute)::int AS members
         FROM advertisements a
         JOIN users u ON u.id = a.author_id
         LEFT JOIN teams t ON t.id = a.team_id
         LEFT JOIN users cap ON cap.id = t.captain_id
         WHERE a.is_closed = FALSE AND a.expires_at > NOW()
         ORDER BY a.created_at DESC`,
    );
    res.json({ ads: rows });
});
