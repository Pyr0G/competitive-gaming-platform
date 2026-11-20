import { Hono, type Context } from "hono";
import { z } from "zod";
import type {
  AdminAction,
  AdminUser,
  Report,
  ReportEvidence,
} from "../shared/contracts";
import {
  csrfGuard,
  fail,
  now,
  readJson,
  requireAdmin,
  requireAuth,
  throttle,
  type AppEnv,
} from "./core";

interface AdminUserRow {
  id: string;
  username: string;
  bio: string;
  created_at: string;
  is_admin: number;
  banned_at: string | null;
  ban_reason: string | null;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  reporter_username: string;
  reported_user_id: string;
  reported_username: string;
  reason: string;
  status: "open" | "resolved";
  evidence_json: string;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface ActionRow {
  id: number;
  actor_username: string;
  target_username: string | null;
  action: AdminAction["action"];
  reason: string;
  created_at: string;
}

const PAGE_SIZE = 25;
const idSchema = z.string().uuid();
const reasonSchema = z
  .object({ reason: z.string().trim().min(3).max(1000) })
  .strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) fail(400, "INVALID_INPUT");
  return result.data;
}

function cursor(
  value: string | undefined,
): { createdAt: string; id: string } | null {
  if (!value) return null;
  const parts = value.split("|");
  if (parts.length !== 2) fail(400, "INVALID_INPUT");
  const createdAt = parse(z.string().datetime({ precision: 3 }), parts[0]);
  const id = parse(idSchema, parts[1]);
  return { createdAt, id };
}

function paged<T extends { id: string; created_at: string }>(rows: T[]) {
  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    rows: page,
    nextCursor:
      rows.length > PAGE_SIZE && last ? `${last.created_at}|${last.id}` : null,
  };
}

function toUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    username: row.username,
    bio: row.bio,
    createdAt: row.created_at,
    isAdmin: Boolean(row.is_admin),
    bannedAt: row.banned_at,
    banReason: row.ban_reason,
  };
}

export const adminRouter = new Hono<AppEnv>();

adminRouter.use("/admin/*", requireAuth, requireAdmin);

adminRouter.get("/admin/users", async (c) => {
  const query = parse(z.string().trim().max(100), c.req.query("q") ?? "")
    .normalize("NFKC")
    .toLowerCase();
  const after = cursor(c.req.query("cursor"));
  await throttle(c, `admin-read:${c.get("account").id}`, 120, 60);
  const { results } = await c.env.DB.prepare(
    `
    SELECT id, username, bio, created_at, is_admin, banned_at, ban_reason FROM users
    WHERE (?1 = '' OR instr(username_key, ?1) > 0)
      AND (?2 = '' OR created_at < ?2 OR (created_at = ?2 AND id < ?3))
    ORDER BY created_at DESC, id DESC LIMIT ${PAGE_SIZE + 1}
  `,
  )
    .bind(query, after?.createdAt ?? "", after?.id ?? "")
    .all<AdminUserRow>();
  const page = paged(results);
  return c.json({ users: page.rows.map(toUser), nextCursor: page.nextCursor });
});

async function moderate(c: Context<AppEnv>, action: "ban" | "unban") {
  const targetId = parse(idSchema, c.req.param("id"));
  const { reason } = await readJson(c, reasonSchema);
  const actorId = c.get("account").id;
  if (actorId === targetId) fail(403, "FORBIDDEN");
  await throttle(c, `admin-write:${actorId}`, 30, 60);
  const timestamp = now();
  const [result] = await c.env.DB.batch([
    c.env.DB.prepare(
      `
      UPDATE users SET banned_at = ?1, ban_reason = ?2
      WHERE id = ?3 AND id <> ?4 AND is_admin = 0 AND banned_at IS ${action === "ban" ? "NULL" : "NOT NULL"}
        AND EXISTS(SELECT 1 FROM users actor WHERE actor.id = ?4 AND actor.is_admin = 1 AND actor.banned_at IS NULL)
    `,
    ).bind(
      action === "ban" ? timestamp : null,
      action === "ban" ? reason : null,
      targetId,
      actorId,
    ),
    c.env.DB.prepare(
      `
      INSERT INTO admin_actions(actor_id, target_user_id, action, reason, created_at)
      SELECT ?1, ?2, ?3, ?4, ?5 WHERE changes() > 0
    `,
    ).bind(actorId, targetId, action, reason, timestamp),
    c.env.DB.prepare(
      "DELETE FROM sessions WHERE user_id = ?1 AND changes() > 0",
    ).bind(targetId),
  ]);
  if (!result.meta.changes) fail(409, "CONFLICT");
  return c.json({});
}

adminRouter.post("/admin/users/:id/ban", csrfGuard, (c) => moderate(c, "ban"));
adminRouter.post("/admin/users/:id/unban", csrfGuard, (c) =>
  moderate(c, "unban"),
);

adminRouter.get("/admin/reports", async (c) => {
  const status = parse(
    z.enum(["open", "resolved"]),
    c.req.query("status") ?? "open",
  );
  const after = cursor(c.req.query("cursor"));
  await throttle(c, `admin-read:${c.get("account").id}`, 120, 60);
  const { results } = await c.env.DB.prepare(
    `
    SELECT r.id, r.reporter_id, reporter.username AS reporter_username, r.reported_user_id,
      reported.username AS reported_username, r.reason, r.status, r.evidence_json,
      r.resolution, r.created_at, r.resolved_at
    FROM reports r
    JOIN users reporter ON reporter.id = r.reporter_id
    JOIN users reported ON reported.id = r.reported_user_id
    WHERE r.status = ?1 AND (?2 = '' OR r.created_at < ?2 OR (r.created_at = ?2 AND r.id < ?3))
    ORDER BY r.created_at DESC, r.id DESC LIMIT ${PAGE_SIZE + 1}
  `,
  )
    .bind(status, after?.createdAt ?? "", after?.id ?? "")
    .all<ReportRow>();
  const page = paged(results);
  const reports: Report[] = page.rows.map((row) => ({
    id: row.id,
    reporterId: row.reporter_id,
    reporterUsername: row.reporter_username,
    reportedUserId: row.reported_user_id,
    reportedUsername: row.reported_username,
    reason: row.reason,
    status: row.status,
    evidence: JSON.parse(row.evidence_json) as ReportEvidence[],
    resolution: row.resolution,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }));
  return c.json({ reports, nextCursor: page.nextCursor });
});

adminRouter.post("/admin/reports/:id/resolve", csrfGuard, async (c) => {
  const reportId = parse(idSchema, c.req.param("id"));
  const { reason } = await readJson(c, reasonSchema);
  const actorId = c.get("account").id;
  const timestamp = now();
  await throttle(c, `admin-write:${actorId}`, 30, 60);
  const [result] = await c.env.DB.batch([
    c.env.DB.prepare(
      `
      UPDATE reports SET status = 'resolved', resolution = ?1, resolved_by = ?2, resolved_at = ?3
      WHERE id = ?4 AND status = 'open'
        AND EXISTS(SELECT 1 FROM users WHERE id = ?2 AND is_admin = 1 AND banned_at IS NULL)
    `,
    ).bind(reason, actorId, timestamp, reportId),
    c.env.DB.prepare(
      `
      INSERT INTO admin_actions(actor_id, target_user_id, report_id, action, reason, created_at)
      SELECT ?1, reported_user_id, id, 'resolve_report', ?2, ?3 FROM reports
      WHERE id = ?4 AND changes() > 0
    `,
    ).bind(actorId, reason, timestamp, reportId),
  ]);
  if (!result.meta.changes) fail(409, "CONFLICT");
  return c.json({});
});

adminRouter.get("/admin/actions", async (c) => {
  const after = c.req.query("cursor")
    ? parse(
        z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        c.req.query("cursor"),
      )
    : 0;
  await throttle(c, `admin-read:${c.get("account").id}`, 120, 60);
  const { results } = await c.env.DB.prepare(
    `
    SELECT a.id, actor.username AS actor_username, target.username AS target_username, a.action, a.reason, a.created_at
    FROM admin_actions a
    JOIN users actor ON actor.id = a.actor_id
    LEFT JOIN users target ON target.id = a.target_user_id
    WHERE (?1 = 0 OR a.id < ?1) ORDER BY a.id DESC LIMIT ${PAGE_SIZE + 1}
  `,
  )
    .bind(after)
    .all<ActionRow>();
  const rows = results.slice(0, PAGE_SIZE);
  const actions: AdminAction[] = rows.map((row) => ({
    id: row.id,
    actorUsername: row.actor_username,
    targetUsername: row.target_username,
    action: row.action,
    reason: row.reason,
    createdAt: row.created_at,
  }));
  return c.json({
    actions,
    nextCursor: results.length > PAGE_SIZE ? String(rows.at(-1)!.id) : null,
  });
});
