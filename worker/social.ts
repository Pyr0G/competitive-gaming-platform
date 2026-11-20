import { Hono } from "hono";
import { z } from "zod";
import type {
  ConversationSummary,
  Message,
  Player,
  ReportEvidence,
} from "../shared/contracts";
import {
  csrfGuard,
  fail,
  newId,
  readJson,
  requireAuth,
  throttle,
  type AppEnv,
} from "./core";

interface MessageRow {
  id: number;
  conversation_id: string;
  sender_id: string;
  body: string;
  client_id: string;
  created_at: string;
}

interface ConversationRow {
  id: string;
  user_low: string;
  user_high: string;
  other_banned_at: string | null;
  blocked_by_me: number;
  blocked_by_other: number;
}

interface SummaryRow {
  id: string;
  player_id: string;
  username: string;
  bio: string;
  player_created_at: string;
  banned_at: string | null;
  blocked_by_me: number;
  blocked_by_other: number;
  unread_count: number;
  message_id: number | null;
  sender_id: string | null;
  body: string | null;
  client_id: string | null;
  message_created_at: string | null;
}

const idSchema = z.string().uuid();
const positiveId = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const PAGE_SIZE = 50;

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) fail(400, "INVALID_INPUT");
  return result.data;
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    clientId: row.client_id,
  };
}

async function conversation(
  db: D1Database,
  id: string,
  userId: string,
): Promise<ConversationRow> {
  const row = await db
    .prepare(
      `
    SELECT c.id, c.user_low, c.user_high, u.banned_at AS other_banned_at,
      EXISTS(SELECT 1 FROM blocks WHERE blocker_id = ?1 AND blocked_id = u.id) AS blocked_by_me,
      EXISTS(SELECT 1 FROM blocks WHERE blocker_id = u.id AND blocked_id = ?1) AS blocked_by_other
    FROM conversations c
    JOIN users u ON u.id = CASE WHEN c.user_low = ?1 THEN c.user_high ELSE c.user_low END
    WHERE c.id = ?2 AND (c.user_low = ?1 OR c.user_high = ?1)
      AND EXISTS(SELECT 1 FROM users WHERE id = ?1 AND banned_at IS NULL)
  `,
    )
    .bind(userId, id)
    .first<ConversationRow>();
  if (!row) fail(404, "NOT_FOUND");
  return row;
}

function assertCanSend(row: ConversationRow) {
  if (row.other_banned_at) fail(403, "UNAVAILABLE");
  if (row.blocked_by_me || row.blocked_by_other) fail(403, "BLOCKED");
}

async function messagePage(
  db: D1Database,
  conversationId: string,
  direction: "before" | "after",
  cursor: number,
) {
  const descending = direction === "before" || cursor === 0;
  const condition =
    cursor === 0 ? "" : direction === "before" ? "AND id < ?2" : "AND id > ?2";
  const statement = db.prepare(`
    SELECT id, conversation_id, sender_id, body, client_id, created_at
    FROM messages WHERE conversation_id = ?1 ${condition}
    ORDER BY id ${descending ? "DESC" : "ASC"} LIMIT ${PAGE_SIZE + 1}
  `);
  const { results } = await (
    cursor === 0
      ? statement.bind(conversationId)
      : statement.bind(conversationId, cursor)
  ).all<MessageRow>();
  const rows = results.slice(0, PAGE_SIZE);
  if (descending) rows.reverse();
  return { messages: rows.map(toMessage), hasMore: results.length > PAGE_SIZE };
}

export const socialRouter = new Hono<AppEnv>();

socialRouter.post("/conversations", requireAuth, csrfGuard, async (c) => {
  const { playerId } = await readJson(
    c,
    z.object({ playerId: idSchema }).strict(),
  );
  const userId = c.get("account").id;
  if (playerId === userId) fail(400, "INVALID_INPUT");
  await throttle(c, `conversation:${userId}`, 20, 60);
  const [low, high] = [userId, playerId].sort();
  const id = newId();
  await c.env.DB.prepare(
    `
    INSERT INTO conversations(id, user_low, user_high)
    SELECT ?1, ?2, ?3
    WHERE EXISTS(SELECT 1 FROM users WHERE id = ?4 AND banned_at IS NULL)
      AND EXISTS(SELECT 1 FROM users WHERE id = ?5 AND banned_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id = ?4 AND blocked_id = ?5) OR (blocker_id = ?5 AND blocked_id = ?4))
    ON CONFLICT(user_low, user_high) DO NOTHING
  `,
  )
    .bind(id, low, high, userId, playerId)
    .run();
  const existing = await c.env.DB.prepare(
    `
    SELECT id FROM conversations WHERE user_low = ?1 AND user_high = ?2
  `,
  )
    .bind(low, high)
    .first<{ id: string }>();
  if (!existing) fail(403, "UNAVAILABLE");
  assertCanSend(await conversation(c.env.DB, existing.id, userId));
  return c.json({ conversationId: existing.id });
});

socialRouter.get("/sync", requireAuth, async (c) => {
  const userId = c.get("account").id;
  await throttle(c, `sync:${userId}`, 60, 60);
  const conversationId = c.req.query("conversationId")
    ? parse(idSchema, c.req.query("conversationId"))
    : undefined;
  const after = parse(
    z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    c.req.query("after") ?? 0,
  );
  if (after && !conversationId) fail(400, "INVALID_INPUT");
  if (conversationId) await conversation(c.env.DB, conversationId, userId);
  const summary = c.env.DB.prepare(
    `
    WITH recent AS (
      SELECT conversation_id FROM conversation_reads
      WHERE user_id = ?1
      ORDER BY latest_message_id DESC, conversation_id DESC
      LIMIT 100
    ), included AS (
      SELECT conversation_id FROM recent UNION SELECT ?2
    )
    SELECT c.id, u.id AS player_id, u.username, u.bio, u.created_at AS player_created_at, u.banned_at,
      EXISTS(SELECT 1 FROM blocks WHERE blocker_id = ?1 AND blocked_id = u.id) AS blocked_by_me,
      EXISTS(SELECT 1 FROM blocks WHERE blocker_id = u.id AND blocked_id = ?1) AS blocked_by_other,
      r.unread_count,
      m.id AS message_id, m.sender_id, m.body, m.client_id, m.created_at AS message_created_at
    FROM included i
    CROSS JOIN conversation_reads r
    JOIN conversations c ON c.id = r.conversation_id
    JOIN users u ON u.id = CASE WHEN c.user_low = ?1 THEN c.user_high ELSE c.user_low END
    LEFT JOIN messages m ON m.id = r.latest_message_id
    WHERE r.user_id = ?1 AND r.conversation_id = i.conversation_id
      AND (c.user_low = ?1 OR c.user_high = ?1)
      AND EXISTS(SELECT 1 FROM users WHERE id = ?1 AND banned_at IS NULL)
    ORDER BY r.latest_message_id DESC, c.id DESC
  `,
  ).bind(userId, conversationId ?? "");
  const count = c.env.DB.prepare(
    `
    SELECT COALESCE((SELECT unread_count FROM users WHERE id = ?1 AND banned_at IS NULL), 0) AS count
  `,
  ).bind(userId);
  const [summaryResult, countResult] = await c.env.DB.batch<
    SummaryRow | { count: number }
  >([summary, count]);
  const conversations: ConversationSummary[] = (
    summaryResult.results as SummaryRow[]
  ).map((row) => {
    const player: Player = {
      id: row.player_id,
      username: row.username,
      bio: row.banned_at ? "" : row.bio,
      createdAt: row.player_created_at,
    };
    return {
      id: row.id,
      player,
      unreadCount: row.unread_count,
      lastMessage:
        row.message_id === null
          ? null
          : {
              id: row.message_id,
              conversationId: row.id,
              senderId: row.sender_id!,
              body: row.body!,
              clientId: row.client_id!,
              createdAt: row.message_created_at!,
            },
      blockedByMe: Boolean(row.blocked_by_me),
      blockedByOther: Boolean(row.blocked_by_other),
      unavailable: Boolean(row.banned_at),
    };
  });
  const page = conversationId
    ? await messagePage(c.env.DB, conversationId, "after", after)
    : { messages: [], hasMore: false };
  return c.json({
    conversations,
    ...page,
    unreadCount: (countResult.results[0] as { count: number }).count,
  });
});

socialRouter.get("/conversations/:id/messages", requireAuth, async (c) => {
  const id = parse(idSchema, c.req.param("id"));
  const before = c.req.query("before")
    ? parse(positiveId, c.req.query("before"))
    : 0;
  const userId = c.get("account").id;
  await throttle(c, `history:${userId}`, 60, 60);
  await conversation(c.env.DB, id, userId);
  return c.json(await messagePage(c.env.DB, id, "before", before));
});

socialRouter.post(
  "/conversations/:id/messages",
  requireAuth,
  csrfGuard,
  async (c) => {
    const id = parse(idSchema, c.req.param("id"));
    const { body, clientId } = await readJson(
      c,
      z
        .object({
          body: z.string().trim().min(1).max(2000),
          clientId: idSchema,
        })
        .strict(),
    );
    const userId = c.get("account").id;
    await throttle(c, `message:${userId}`, 60, 60);
    await throttle(c, `message-target:${userId}:${id}`, 30, 60);
    const existingConversation = await conversation(c.env.DB, id, userId);
    assertCanSend(existingConversation);
    await c.env.DB.prepare(
      `
    INSERT INTO messages(conversation_id, sender_id, body, client_id)
    SELECT c.id, ?1, ?2, ?3 FROM conversations c
    JOIN users other ON other.id = CASE WHEN c.user_low = ?1 THEN c.user_high ELSE c.user_low END
    WHERE c.id = ?4 AND (c.user_low = ?1 OR c.user_high = ?1) AND other.banned_at IS NULL
      AND EXISTS(SELECT 1 FROM users WHERE id = ?1 AND banned_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id = ?1 AND blocked_id = other.id) OR (blocker_id = other.id AND blocked_id = ?1))
    ON CONFLICT(conversation_id, sender_id, client_id) DO NOTHING
  `,
    )
      .bind(userId, body, clientId, id)
      .run();
    const message = await c.env.DB.prepare(
      `
    SELECT id, conversation_id, sender_id, body, client_id, created_at FROM messages
    WHERE conversation_id = ?1 AND sender_id = ?2 AND client_id = ?3
      AND EXISTS(SELECT 1 FROM users WHERE id = ?2 AND banned_at IS NULL)
  `,
    )
      .bind(id, userId, clientId)
      .first<MessageRow>();
    if (!message) fail(403, "UNAVAILABLE");
    if (message.body !== body) fail(409, "CONFLICT");
    return c.json({ message: toMessage(message) });
  },
);

socialRouter.post(
  "/conversations/:id/read",
  requireAuth,
  csrfGuard,
  async (c) => {
    const id = parse(idSchema, c.req.param("id"));
    const { messageId } = await readJson(
      c,
      z.object({ messageId: positiveId }).strict(),
    );
    const userId = c.get("account").id;
    await throttle(c, `read:${userId}`, 120, 60);
    const result = await c.env.DB.prepare(
      `
    INSERT INTO conversation_reads(user_id, conversation_id, last_message_id)
    SELECT ?1, c.id, m.id FROM conversations c
    JOIN messages m ON m.conversation_id = c.id AND m.id = ?2
    WHERE c.id = ?3 AND (c.user_low = ?1 OR c.user_high = ?1)
      AND EXISTS(SELECT 1 FROM users WHERE id = ?1 AND banned_at IS NULL)
    ON CONFLICT(user_id, conversation_id) DO UPDATE
      SET last_message_id = MAX(conversation_reads.last_message_id, excluded.last_message_id)
  `,
    )
      .bind(userId, messageId, id)
      .run();
    if (!result.meta.changes) fail(404, "NOT_FOUND");
    return c.json({});
  },
);

socialRouter.put("/blocks/:playerId", requireAuth, csrfGuard, async (c) => {
  const playerId = parse(idSchema, c.req.param("playerId"));
  const userId = c.get("account").id;
  if (playerId === userId) fail(400, "INVALID_INPUT");
  await throttle(c, `block:${userId}`, 30, 60);
  const result = await c.env.DB.prepare(
    `
    INSERT INTO blocks(blocker_id, blocked_id)
    SELECT ?1, id FROM users WHERE id = ?2
      AND EXISTS(SELECT 1 FROM users WHERE id = ?1 AND banned_at IS NULL)
    ON CONFLICT(blocker_id, blocked_id) DO UPDATE SET blocked_id = excluded.blocked_id
  `,
  )
    .bind(userId, playerId)
    .run();
  if (!result.meta.changes) fail(404, "NOT_FOUND");
  return c.json({});
});

socialRouter.delete("/blocks/:playerId", requireAuth, csrfGuard, async (c) => {
  const playerId = parse(idSchema, c.req.param("playerId"));
  const userId = c.get("account").id;
  if (playerId === userId) fail(400, "INVALID_INPUT");
  await throttle(c, `block:${userId}`, 30, 60);
  await c.env.DB.prepare(
    `
    DELETE FROM blocks WHERE blocker_id = ?1 AND blocked_id = ?2
      AND EXISTS(SELECT 1 FROM users WHERE id = ?1 AND banned_at IS NULL)
  `,
  )
    .bind(userId, playerId)
    .run();
  return c.json({});
});

socialRouter.post("/reports", requireAuth, csrfGuard, async (c) => {
  const { messageId, reason } = await readJson(
    c,
    z
      .object({
        messageId: positiveId,
        reason: z.string().trim().min(3).max(1000),
      })
      .strict(),
  );
  const userId = c.get("account").id;
  await throttle(c, `report:${userId}`, 5, 900);
  const message = await c.env.DB.prepare(
    `
    SELECT m.id, m.conversation_id, m.sender_id FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = ?1 AND (c.user_low = ?2 OR c.user_high = ?2) AND m.sender_id <> ?2
  `,
  )
    .bind(messageId, userId)
    .first<{ id: number; conversation_id: string; sender_id: string }>();
  if (!message) fail(404, "NOT_FOUND");
  const evidenceRows = await c.env.DB.prepare(
    `
    SELECT m.id, m.sender_id, u.username, m.body, m.created_at FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?1 AND m.id <= ?2 ORDER BY m.id DESC LIMIT 6
  `,
  )
    .bind(message.conversation_id, messageId)
    .all<{
      id: number;
      sender_id: string;
      username: string;
      body: string;
      created_at: string;
    }>();
  const evidence: ReportEvidence[] = evidenceRows.results
    .reverse()
    .map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      username: row.username,
      body: row.body,
      createdAt: row.created_at,
    }));
  const result = await c.env.DB.prepare(
    `
    INSERT INTO reports(id, reporter_id, reported_user_id, conversation_id, message_id, reason, evidence_json)
    SELECT ?1, ?2, m.sender_id, m.conversation_id, m.id, ?3, ?4 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = ?5 AND (c.user_low = ?2 OR c.user_high = ?2) AND m.sender_id <> ?2
      AND EXISTS(SELECT 1 FROM users WHERE id = ?2 AND banned_at IS NULL)
    ON CONFLICT(reporter_id, message_id) DO NOTHING
  `,
  )
    .bind(newId(), userId, reason, JSON.stringify(evidence), messageId)
    .run();
  if (!result.meta.changes) fail(409, "CONFLICT");
  return c.json({}, 201);
});
