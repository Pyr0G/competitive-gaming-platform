import { Hono } from "hono";
import { z } from "zod";
import type { Post, PostsResponse } from "../shared/contracts";
import {
  csrfGuard,
  fail,
  newId,
  now,
  readJson,
  requireAdmin,
  requireAuth,
  throttle,
  type AppEnv,
} from "./core";

interface PostRow {
  id: string;
  title: string;
  body: string;
  author_username: string;
  created_at: string;
  updated_at: string;
}

const postSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

export const postsRouter = new Hono<AppEnv>();

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    authorUsername: row.author_username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const listSql = `SELECT posts.id, posts.title, posts.body, users.username AS author_username, posts.created_at, posts.updated_at
  FROM posts INNER JOIN users ON users.id = posts.author_id
  ORDER BY posts.created_at DESC, posts.id DESC LIMIT 50`;

postsRouter.get("/posts", async (c) => {
  await throttle(c, `posts:${c.get("account")?.id ?? "public"}`, 60, 60);
  const result = await c.env.DB.prepare(listSql).all<PostRow>();
  const response: PostsResponse = { posts: result.results.map(toPost) };
  return c.json(response);
});

postsRouter.get("/admin/posts", requireAuth, requireAdmin, async (c) => {
  await throttle(c, `admin:posts:${c.get("account").id}`, 60, 60);
  const result = await c.env.DB.prepare(listSql).all<PostRow>();
  return c.json({ posts: result.results.map(toPost) });
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
    await c.env.DB.prepare(
      "INSERT INTO posts (id, author_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, account.id, body.title, body.body, created, created)
      .run();
    const row = await c.env.DB.prepare(
      `SELECT posts.id, posts.title, posts.body, users.username AS author_username, posts.created_at, posts.updated_at
       FROM posts INNER JOIN users ON users.id = posts.author_id WHERE posts.id = ?`,
    )
      .bind(id)
      .first<PostRow>();
    if (!row) fail(500, "INTERNAL_ERROR");
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
    const result = await c.env.DB.prepare(
      "UPDATE posts SET title = ?, body = ?, updated_at = ? WHERE id = ?",
    )
      .bind(body.title, body.body, updated, parsed.data)
      .run();
    if (result.meta.changes !== 1) fail(404, "NOT_FOUND");
    const row = await c.env.DB.prepare(
      `SELECT posts.id, posts.title, posts.body, users.username AS author_username, posts.created_at, posts.updated_at
       FROM posts INNER JOIN users ON users.id = posts.author_id WHERE posts.id = ?`,
    )
      .bind(parsed.data)
      .first<PostRow>();
    if (!row) fail(404, "NOT_FOUND");
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
    const result = await c.env.DB.prepare("DELETE FROM posts WHERE id = ?")
      .bind(parsed.data)
      .run();
    if (result.meta.changes !== 1) fail(404, "NOT_FOUND");
    return c.json({});
  },
);
