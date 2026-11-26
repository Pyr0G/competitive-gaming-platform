import { Hono, type Context } from "hono";
import { z } from "zod";
import type {
  AdminPostsResponse,
  Post,
  PostsResponse,
} from "../shared/contracts";
import { postBannerUrl } from "../shared/post-banner";
import {
  ADMIN_PAGE_SIZE,
  activeSessionSql,
  adminCursor,
  adminPage,
  csrfGuard,
  fail,
  newId,
  now,
  readJson,
  requestKey,
  requireAdmin,
  requireAuth,
  throttle,
  type AppEnv,
} from "./core";

interface PostRow {
  id: string;
  title: string;
  body: string;
  banner_url: string | null;
  author_username: string;
  created_at: string;
  updated_at: string;
}

const bannerUrlSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const url = postBannerUrl(value);
    if (url) return url;
    ctx.addIssue({ code: "custom", message: "Invalid banner URL" });
    return z.NEVER;
  });

const postSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(4000),
    bannerUrl: bannerUrlSchema.optional(),
  })
  .strict();

export const postsRouter = new Hono<AppEnv>();

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    bannerUrl: postBannerUrl(row.banner_url) ?? null,
    authorUsername: row.author_username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const listSql = `SELECT posts.id, posts.title, posts.body, posts.banner_url, users.username AS author_username, posts.created_at, posts.updated_at
  FROM posts INNER JOIN users ON users.id = posts.author_id`;
const postOrderSql = "ORDER BY posts.created_at DESC, posts.id DESC";
const adminActorSql = `SELECT 1 ${activeSessionSql} AND users.is_admin = 1`;
const postReturningSql = `id, title, body, banner_url, (SELECT username FROM users WHERE users.id = posts.author_id) AS author_username, created_at, updated_at`;

async function assertCurrentAdmin(c: Context<AppEnv>) {
  const actor = await c.env.DB.prepare(
    `SELECT users.is_admin ${activeSessionSql}`,
  )
    .bind(c.get("account").id, c.get("session").token_hash)
    .first<{ is_admin: number }>();
  if (!actor) fail(401, "UNAUTHENTICATED");
  if (actor.is_admin !== 1) fail(403, "FORBIDDEN");
}

postsRouter.get("/posts", async (c) => {
  await throttle(c, `posts:${c.get("account")?.id ?? requestKey(c)}`, 60, 60);
  const result = await c.env.DB.prepare(
    `${listSql} ${postOrderSql} LIMIT 4`,
  ).all<PostRow>();
  const response: PostsResponse = { posts: result.results.map(toPost) };
  return c.json(response);
});

postsRouter.get("/admin/posts", requireAuth, requireAdmin, async (c) => {
  const after = adminCursor(c.req.query("cursor"));
  await throttle(c, `admin:posts:${c.get("account").id}`, 60, 60);
  const query = c.env.DB.prepare(
    `${listSql} ${after ? "WHERE (posts.created_at, posts.id) < (?, ?)" : ""}
     ${postOrderSql} LIMIT ${ADMIN_PAGE_SIZE + 1}`,
  );
  const result = await (
    after ? query.bind(after.createdAt, after.id) : query
  ).all<PostRow>();
  const page = adminPage(result.results);
  const response: AdminPostsResponse = {
    posts: page.rows.map(toPost),
    nextCursor: page.nextCursor,
  };
  return c.json(response);
});

postsRouter.post(
  "/admin/posts",
  requireAuth,
  requireAdmin,
  csrfGuard,
  async (c) => {
    const account = c.get("account");
    await throttle(c, `admin:posts:write:${account.id}`, 20, 3600);
    const body = await readJson(c, postSchema);
    const id = newId();
    const created = now();
    const row = await c.env.DB.prepare(
      `INSERT INTO posts (id, author_id, title, body, banner_url, created_at, updated_at)
       SELECT ?, users.id, ?, ?, ?, ?, ? ${activeSessionSql} AND users.is_admin = 1
       RETURNING ${postReturningSql}`,
    )
      .bind(
        id,
        body.title,
        body.body,
        body.bannerUrl ?? null,
        created,
        created,
        account.id,
        c.get("session").token_hash,
      )
      .first<PostRow>();
    if (!row) {
      await assertCurrentAdmin(c);
      fail(403, "FORBIDDEN");
    }
    return c.json({ post: toPost(row) }, 201);
  },
);

postsRouter.patch(
  "/admin/posts/:id",
  requireAuth,
  requireAdmin,
  csrfGuard,
  async (c) => {
    const account = c.get("account");
    await throttle(c, `admin:posts:write:${account.id}`, 20, 3600);
    const parsed = z.uuid().safeParse(c.req.param("id"));
    if (!parsed.success) fail(404, "NOT_FOUND");
    const body = await readJson(c, postSchema);
    const updated = now();
    const row = await c.env.DB.prepare(
      `UPDATE posts SET title = ?, body = ?,
       banner_url = CASE WHEN ? THEN ? ELSE banner_url END, updated_at = ?
       WHERE id = ? AND EXISTS (${adminActorSql}) RETURNING ${postReturningSql}`,
    )
      .bind(
        body.title,
        body.body,
        body.bannerUrl === undefined ? 0 : 1,
        body.bannerUrl ?? null,
        updated,
        parsed.data,
        account.id,
        c.get("session").token_hash,
      )
      .first<PostRow>();
    if (!row) {
      await assertCurrentAdmin(c);
      fail(404, "NOT_FOUND");
    }
    return c.json({ post: toPost(row) });
  },
);

postsRouter.delete(
  "/admin/posts/:id",
  requireAuth,
  requireAdmin,
  csrfGuard,
  async (c) => {
    const account = c.get("account");
    await throttle(c, `admin:posts:write:${account.id}`, 20, 3600);
    const parsed = z.uuid().safeParse(c.req.param("id"));
    if (!parsed.success) fail(404, "NOT_FOUND");
    const result = await c.env.DB.prepare(
      `DELETE FROM posts WHERE id = ? AND EXISTS (${adminActorSql})`,
    )
      .bind(parsed.data, account.id, c.get("session").token_hash)
      .run();
    if (result.meta.changes !== 1) {
      await assertCurrentAdmin(c);
      fail(404, "NOT_FOUND");
    }
    return c.json({});
  },
);
