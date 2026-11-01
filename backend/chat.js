import { Router } from "express";
import { query } from "./db.js";
import { limit, requireUser } from "./auth.js";
import { createTypingStore } from "./typing-state.js";

export const chat = Router();

const typing = createTypingStore();
const pair = (a, b) => (a < b ? [a, b] : [b, a]);
const peerOf = (row, me) => (Number(row.user_a_id) === me ? Number(row.user_b_id) : Number(row.user_a_id));

const findConv = (id, me) => query(
    `SELECT c.id, c.user_a_id, c.user_b_id,
            CASE WHEN c.user_a_id = $2 THEN ub.nick ELSE ua.nick END AS nick
     FROM conversations c
     JOIN users ua ON ua.id = c.user_a_id
     JOIN users ub ON ub.id = c.user_b_id
     WHERE c.id = $1 AND $2 IN (c.user_a_id, c.user_b_id)`,
    [id, me],
);

chat.get("/unread", requireUser, async (req, res) => {
    const { rows } = await query(
        `SELECT COUNT(*)::int AS n
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE $1 IN (c.user_a_id, c.user_b_id) AND m.sender_id <> $1 AND m.read_at IS NULL`,
        [req.userId],
    );
    res.json({ unread: rows[0].n });
});

chat.get("/", requireUser, async (req, res) => {
    const { rows } = await query(
        `SELECT c.id::int,
                CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END::int AS peer_id,
                CASE WHEN c.user_a_id = $1 THEN ub.nick ELSE ua.nick END AS nick,
                lm.content, lm.sent_at,
                (SELECT COUNT(*)::int FROM messages m
                 WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread,
                EXISTS (
                    SELECT 1 FROM user_blocks
                    WHERE blocker_id = $1
                      AND blocked_id = CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
                ) AS blocked
         FROM conversations c
         JOIN users ua ON ua.id = c.user_a_id
         JOIN users ub ON ub.id = c.user_b_id
         LEFT JOIN LATERAL (
             SELECT content, sent_at FROM messages WHERE conversation_id = c.id ORDER BY sent_at DESC, id DESC LIMIT 1
         ) lm ON TRUE
         WHERE $1 IN (c.user_a_id, c.user_b_id)
         ORDER BY COALESCE(lm.sent_at, c.created_at) DESC`,
        [req.userId],
    );
    res.json({ conversations: rows });
});

chat.post("/open", requireUser, limit("chat:open", 20, 10), async (req, res) => {
    const peer = Number(req.body.userId);
    if (!Number.isInteger(peer) || peer === req.userId) {
        return res.status(400).json({ error: "Wybierz gracza, do którego chcesz napisać." });
    }
    const { rows: people } = await query("SELECT id FROM users WHERE id = $1 AND banned_at IS NULL", [peer]);
    if (!people.length) return res.status(404).json({ error: "Nie ma takiego gracza." });

    const [a, b] = pair(req.userId, peer);
    const { rows } = await query(
        `INSERT INTO conversations (user_a_id, user_b_id) VALUES ($1, $2)
         ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET user_a_id = conversations.user_a_id
         RETURNING id::int`,
        [a, b],
    );
    res.json({ id: rows[0].id });
});

chat.get("/:id", requireUser, async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await findConv(id, req.userId);
    if (!rows.length) return res.status(404).json({ error: "Nie ma takiej rozmowy." });

    const peer = peerOf(rows[0], req.userId);
    await query(
        "UPDATE messages SET read_at = NOW() WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL",
        [id, req.userId],
    );

    const after = Number(req.query.after) || 0;
    const { rows: messages } = await query(
        `SELECT id::int, sender_id::int, content, sent_at, sender_id = $2 AS mine
         FROM messages WHERE conversation_id = $1 AND id > $3
         ORDER BY sent_at, id`,
        [id, req.userId, after],
    );

    const { rows: flags } = await query(
        `SELECT
            EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2) AS blocked,
            EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $2 AND blocked_id = $1) AS blocked_by`,
        [req.userId, peer],
    );

    res.json({
        conversation: {
            id,
            peer_id: peer,
            nick: rows[0].nick,
            blocked: flags[0].blocked,
            blocked_by: flags[0].blocked_by,
            typing: typing.has(`${id}:${peer}`),
        },
        messages,
    });
});

chat.post("/:id", requireUser, limit("chat:send", 40, 10), async (req, res) => {
    const id = Number(req.params.id);
    const content = String(req.body.content || "").trim();
    if (content.length < 1 || content.length > 1000) {
        return res.status(400).json({ error: "Wiadomość musi mieć od 1 do 1000 znaków." });
    }

    const { rows } = await findConv(id, req.userId);
    if (!rows.length) return res.status(404).json({ error: "Nie ma takiej rozmowy." });

    const peer = peerOf(rows[0], req.userId);
    const { rows: block } = await query(
        "SELECT blocker_id FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)",
        [req.userId, peer],
    );
    if (block.length) {
        const mine = Number(block[0].blocker_id) === req.userId;
        return res.status(403).json({ error: mine ? "Odblokuj gracza, żeby znowu pisać." : "Ten gracz nie przyjmuje wiadomości." });
    }

    const { rows: saved } = await query(
        `INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)
         RETURNING id::int, sender_id::int, content, sent_at, TRUE AS mine`,
        [id, req.userId, content],
    );
    typing.delete(`${id}:${req.userId}`);
    res.status(201).json({ message: saved[0] });
});

chat.post("/:id/typing", requireUser, limit("chat:typing", 120, 1), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Nie ma takiej rozmowy." });
    const { rows } = await findConv(id, req.userId);
    if (!rows.length) return res.status(404).json({ error: "Nie ma takiej rozmowy." });
    if (!typing.set(`${id}:${req.userId}`)) {
        res.set("Retry-After", "3");
        return res.status(503).json({ error: "Serwer jest teraz zajęty. Spróbuj za chwilę." });
    }
    res.json({ ok: true });
});

chat.post("/:id/block", requireUser, async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await findConv(id, req.userId);
    if (!rows.length) return res.status(404).json({ error: "Nie ma takiej rozmowy." });
    const peer = peerOf(rows[0], req.userId);
    await query(
        "INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [req.userId, peer],
    );
    res.json({ ok: true });
});

chat.delete("/:id/block", requireUser, async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await findConv(id, req.userId);
    if (!rows.length) return res.status(404).json({ error: "Nie ma takiej rozmowy." });
    await query("DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2", [req.userId, peerOf(rows[0], req.userId)]);
    res.json({ ok: true });
});

chat.post("/:id/report", requireUser, limit("chat:report", 8, 60), async (req, res) => {
    const id = Number(req.params.id);
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 8 || reason.length > 500) {
        return res.status(400).json({ error: "Opisz zgłoszenie, od 8 do 500 znaków." });
    }
    const { rows } = await findConv(id, req.userId);
    if (!rows.length) return res.status(404).json({ error: "Nie ma takiej rozmowy." });
    const peer = peerOf(rows[0], req.userId);
    await query(
        "INSERT INTO user_reports (reporter_id, reported_id, conversation_id, reason) VALUES ($1, $2, $3, $4)",
        [req.userId, peer, id, reason],
    );
    res.status(201).json({ ok: true });
});
