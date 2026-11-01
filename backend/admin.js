import { Router } from "express";
import { query } from "./db.js";
import { requireAdmin } from "./auth.js";

export const admin = Router();

admin.use(requireAdmin);

admin.get("/stats", async (req, res) => {
    const [users, ads, messages, reports, live] = await Promise.all([
        query("SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE banned_at IS NOT NULL)::int AS banned FROM users"),
        query("SELECT COUNT(*)::int AS n FROM advertisements WHERE is_closed = FALSE AND expires_at > NOW()"),
        query("SELECT COUNT(*)::int AS n FROM messages"),
        query("SELECT COUNT(*)::int AS n FROM user_reports WHERE NOT resolved"),
        query("SELECT COUNT(*)::int AS n FROM tournaments WHERE status = 'in_progress'"),
    ]);
    res.json({
        users: users.rows[0].n,
        banned: users.rows[0].banned,
        ads: ads.rows[0].n,
        messages: messages.rows[0].n,
        reports: reports.rows[0].n,
        live: live.rows[0].n,
    });
});

admin.get("/users", async (req, res) => {
    const q = String(req.query.q || "").trim();
    const { rows } = await query(
        `SELECT u.id::int, u.nick, u.email, u.is_admin, u.banned_at, u.created_at, u.email_verified_at, u.faceit_level, t.tag
         FROM users u
         LEFT JOIN teams t ON t.captain_id = u.id
         WHERE $1 = '' OR u.nick ILIKE $2 OR u.email ILIKE $2
         ORDER BY u.created_at DESC
         LIMIT 80`,
        [q, `%${q}%`],
    );
    res.json({ users: rows });
});

admin.post("/users/:id/ban", async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.userId) return res.status(400).json({ error: "Nie możesz zablokować siebie." });
    const { rowCount } = await query(
        "UPDATE users SET banned_at = NOW(), is_admin = FALSE WHERE id = $1 AND banned_at IS NULL",
        [id],
    );
    if (!rowCount) return res.status(404).json({ error: "Nie ma takiego konta albo jest już zablokowane." });
    res.json({ ok: true });
});

admin.post("/users/:id/unban", async (req, res) => {
    const { rowCount } = await query(
        "UPDATE users SET banned_at = NULL WHERE id = $1 AND banned_at IS NOT NULL",
        [Number(req.params.id)],
    );
    if (!rowCount) return res.status(404).json({ error: "To konto nie jest zablokowane." });
    res.json({ ok: true });
});

admin.post("/users/:id/admin", async (req, res) => {
    const id = Number(req.params.id);
    const on = req.body.on === true;
    if (id === req.userId && !on) return res.status(400).json({ error: "Nie możesz zabrać sobie uprawnień." });
    const { rowCount } = await query(
        "UPDATE users SET is_admin = $2 WHERE id = $1 AND banned_at IS NULL",
        [id, on],
    );
    if (!rowCount) return res.status(404).json({ error: "Nie ma takiego konta." });
    res.json({ ok: true });
});

admin.post("/users/:id/verify", async (req, res) => {
    const { rowCount } = await query(
        "UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1",
        [Number(req.params.id)],
    );
    if (!rowCount) return res.status(404).json({ error: "Nie ma takiego konta." });
    res.json({ ok: true });
});

admin.get("/ads", async (req, res) => {
    const { rows } = await query(
        `SELECT a.id::int, a.type, a.role, a.faceit_level, a.description, a.created_at, a.is_closed, a.expires_at,
                u.nick, t.tag
         FROM advertisements a
         JOIN users u ON u.id = a.author_id
         LEFT JOIN teams t ON t.id = a.team_id
         ORDER BY a.created_at DESC
         LIMIT 80`,
    );
    res.json({ ads: rows });
});

admin.delete("/ads/:id", async (req, res) => {
    const { rowCount } = await query(
        "UPDATE advertisements SET is_closed = TRUE WHERE id = $1 AND is_closed = FALSE",
        [Number(req.params.id)],
    );
    if (!rowCount) return res.status(404).json({ error: "Ogłoszenie jest już zamknięte albo nie istnieje." });
    res.json({ ok: true });
});

admin.get("/reports", async (req, res) => {
    const { rows } = await query(
        `SELECT r.id::int, r.reason, r.resolved, r.created_at, r.conversation_id::int,
                a.nick AS reporter, b.nick AS reported, b.id::int AS reported_id
         FROM user_reports r
         JOIN users a ON a.id = r.reporter_id
         JOIN users b ON b.id = r.reported_id
         ORDER BY r.resolved, r.created_at DESC
         LIMIT 80`,
    );
    const ids = rows.map((r) => r.conversation_id).filter(Boolean);
    let snippets = [];
    if (ids.length) {
        const { rows: msgs } = await query(
            `SELECT conversation_id::int, u.nick, m.content, m.sent_at
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.conversation_id = ANY($1::bigint[])
             ORDER BY m.sent_at DESC
             LIMIT 40`,
            [ids],
        );
        snippets = msgs;
    }
    res.json({
        reports: rows.map((r) => ({
            ...r,
            messages: snippets.filter((m) => m.conversation_id === r.conversation_id).slice(0, 4).reverse(),
        })),
    });
});

admin.post("/reports/:id/resolve", async (req, res) => {
    const { rowCount } = await query(
        "UPDATE user_reports SET resolved = TRUE WHERE id = $1 AND resolved = FALSE",
        [Number(req.params.id)],
    );
    if (!rowCount) return res.status(404).json({ error: "Zgłoszenie jest już zamknięte albo nie istnieje." });
    res.json({ ok: true });
});

admin.get("/tournaments", async (req, res) => {
    const { rows } = await query(
        `SELECT t.id::int, t.name, t.status, t.format, t.max_teams, t.starts_at,
                (SELECT COUNT(*)::int FROM tournament_teams tt WHERE tt.tournament_id = t.id) AS teams
         FROM tournaments t
         ORDER BY t.starts_at DESC`,
    );
    res.json({ tournaments: rows });
});

admin.post("/tournaments/:id/cancel", async (req, res) => {
    const { rowCount } = await query(
        "UPDATE tournaments SET status = 'cancelled' WHERE id = $1 AND status IN ('registration', 'in_progress')",
        [Number(req.params.id)],
    );
    if (!rowCount) return res.status(400).json({ error: "Ten turniej jest już zakończony albo odwołany." });
    res.json({ ok: true });
});

admin.post("/tournaments/:id/close-reg", async (req, res) => {
    const { rowCount } = await query(
        "UPDATE tournaments SET registration_closes_at = NOW() WHERE id = $1 AND status = 'registration'",
        [Number(req.params.id)],
    );
    if (!rowCount) return res.status(400).json({ error: "Zapisy w tym turnieju nie są otwarte." });
    res.json({ ok: true });
});

admin.get("/announcement", async (req, res) => {
    const { rows } = await query("SELECT id::int, content FROM announcements WHERE is_active ORDER BY created_at DESC LIMIT 1");
    res.json({ announcement: rows[0] || null });
});

admin.post("/announcement", async (req, res) => {
    const content = String(req.body.content || "").trim();
    if (content.length < 8 || content.length > 200) {
        return res.status(400).json({ error: "Komunikat musi mieć od 8 do 200 znaków." });
    }
    await query("UPDATE announcements SET is_active = FALSE WHERE is_active");
    const { rows } = await query(
        "INSERT INTO announcements (content, created_by) VALUES ($1, $2) RETURNING id::int, content",
        [content, req.userId],
    );
    res.status(201).json({ announcement: rows[0] });
});

admin.delete("/announcement", async (req, res) => {
    await query("UPDATE announcements SET is_active = FALSE WHERE is_active");
    res.json({ ok: true });
});
