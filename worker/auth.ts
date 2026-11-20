import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { Context } from "hono";
import { z } from "zod";
import type { AuthResponse, SearchResponse } from "../shared/contracts";
import {
  clearSessionCookie,
  csrfGuard,
  fail,
  newId,
  readJson,
  requestKey,
  requireAuth,
  runtimeSettings,
  sha256,
  throttle,
  toAccount,
  toPlayer,
} from "./core";
import type { AppEnv, UserRow } from "./core";
import { dummyPasswordHash } from "./passwords";

const usernameSchema = z
  .string()
  .max(256)
  .transform((value) => value.normalize("NFKC"))
  .refine(
    (value) =>
      [...value].length >= 3 &&
      [...value].length <= 24 &&
      /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_.-]*$/u.test(value),
  );
const passwordSchema = z
  .string()
  .refine(
    (value) =>
      [...value].length >= 8 &&
      [...value].length <= 128 &&
      new TextEncoder().encode(value).byteLength <= 1024,
  );
const localeSchema = z
  .string()
  .max(64)
  .refine((value) => {
    try {
      return Intl.DateTimeFormat.supportedLocalesOf(value).length === 1;
    } catch {
      return false;
    }
  })
  .transform((value) => Intl.getCanonicalLocales(value)[0]);
const timeZoneSchema = z
  .string()
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  })
  .transform(
    (value) =>
      new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions()
        .timeZone,
  );
const preferences = {
  language: z.enum(["en", "pl"]).default("en"),
  locale: localeSchema.default("en-GB"),
  timeZone: timeZoneSchema.default("UTC"),
};
const registrationSchema = z
  .object({
    username: usernameSchema,
    email: z.string().trim().max(254).pipe(z.email()),
    password: passwordSchema,
    passwordConfirmation: z.string(),
    ...preferences,
  })
  .strict()
  .refine((value) => value.password === value.passwordConfirmation);
const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().max(1024),
  })
  .strict();
const accountSchema = z
  .object({
    username: usernameSchema,
    bio: z.string().refine((value) => [...value].length <= 500),
    ...preferences,
  })
  .strict();
const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(1024),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .strict()
  .refine((value) => value.password === value.passwordConfirmation);
const searchCursorSchema = z
  .object({ key: z.string().max(256), id: z.uuid() })
  .strict();

export const authRouter = new Hono<AppEnv>();

function authResponse(c: Context<AppEnv>): AuthResponse {
  return {
    account: c.get("account") ?? null,
    csrfToken: c.get("session")?.csrf_token ?? null,
  };
}

async function passwordHash(
  c: Context<AppEnv>,
  password: string,
): Promise<string> {
  try {
    return await c.env.PASSWORD_HASHER.getByName("passwords").hash(password);
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

async function verifyPassword(
  c: Context<AppEnv>,
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await c.env.PASSWORD_HASHER.getByName("passwords").verify(
      password,
      hash,
    );
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

async function issueSession(
  c: Context<AppEnv>,
  userId: string,
  expectedPasswordHash: string,
  initialStatements: D1PreparedStatement[] = [],
): Promise<AuthResponse> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = await sha256(token);
  const csrfToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const statements = [...initialStatements];
  const previousSession = c.get("session");
  if (previousSession)
    statements.push(
      c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(
        previousSession.token_hash,
      ),
    );
  const insertIndex = statements.length;
  statements.push(
    c.env.DB.prepare(
      "INSERT INTO sessions (token_hash, csrf_token, user_id, expires_at) SELECT ?, ?, id, ? FROM users WHERE id = ? AND password_hash = ? AND banned_at IS NULL",
    ).bind(tokenHash, csrfToken, expiresAt, userId, expectedPasswordHash),
  );
  statements.push(
    c.env.DB.prepare(
      "DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires_at <= ? LIMIT 100)",
    ).bind(new Date().toISOString()),
  );
  statements.push(
    c.env.DB.prepare(
      "DELETE FROM sessions WHERE user_id = ? AND token_hash <> ? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id = ? AND token_hash <> ? ORDER BY created_at DESC, token_hash DESC LIMIT 19)",
    ).bind(userId, tokenHash, userId, tokenHash),
  );
  const results = await c.env.DB.batch(statements);
  if (results[insertIndex].meta.changes !== 1) fail(401, "INVALID_CREDENTIALS");
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ? AND banned_at IS NULL",
  )
    .bind(userId)
    .first<UserRow>();
  if (!user) fail(401, "UNAUTHENTICATED");
  const settings = runtimeSettings(c);
  setCookie(c, settings.cookieName, token, {
    httpOnly: true,
    secure: settings.secure,
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return { account: toAccount(user), csrfToken };
}

function uniqueConflict(error: unknown): boolean {
  return (
    error instanceof Error && /UNIQUE constraint failed/.test(error.message)
  );
}

authRouter.get("/auth/me", (c) => c.json(authResponse(c)));

authRouter.post("/auth/register", async (c) => {
  await throttle(c, `register:ip:${requestKey(c)}`, 10, 3600);
  const body = await readJson(c, registrationSchema);
  await throttle(c, `register:email:${body.email.toLowerCase()}`, 5, 3600);
  const id = newId();
  const hash = await passwordHash(c, body.password);
  try {
    const response = await issueSession(c, id, hash, [
      c.env.DB.prepare(
        "INSERT INTO users (id, username, username_key, email, email_key, password_hash, language, locale, time_zone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        id,
        body.username,
        body.username.toLowerCase(),
        body.email,
        body.email.toLowerCase(),
        hash,
        body.language,
        body.locale,
        body.timeZone,
      ),
    ]);
    return c.json(response, 201);
  } catch (error) {
    if (uniqueConflict(error)) fail(409, "ACCOUNT_UNAVAILABLE");
    throw error;
  }
});

authRouter.post("/auth/login", async (c) => {
  await throttle(c, `login:ip:${requestKey(c)}`, 30, 900);
  const body = await readJson(c, loginSchema);
  const key = body.identifier.normalize("NFKC").toLowerCase();
  await throttle(c, `login:identifier:${key}`, 10, 900);
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE username_key = ? OR email_key = ? LIMIT 1",
  )
    .bind(key, key)
    .first<UserRow>();
  const valid = await verifyPassword(
    c,
    body.password,
    user?.password_hash ?? dummyPasswordHash,
  );
  if (!user || !valid) fail(401, "INVALID_CREDENTIALS");
  if (user.banned_at) fail(403, "ACCOUNT_BANNED");
  return c.json(await issueSession(c, user.id, user.password_hash));
});

authRouter.post("/auth/logout", requireAuth, csrfGuard, async (c) => {
  await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(c.get("session").token_hash)
    .run();
  clearSessionCookie(c);
  return c.json({});
});

authRouter.patch("/account", requireAuth, csrfGuard, async (c) => {
  const account = c.get("account");
  await throttle(c, `account:update:${account.id}`, 30, 3600);
  const body = await readJson(c, accountSchema);
  try {
    const result = await c.env.DB.prepare(
      "UPDATE users SET username = ?, username_key = ?, bio = ?, language = ?, locale = ?, time_zone = ? WHERE id = ? AND banned_at IS NULL",
    )
      .bind(
        body.username,
        body.username.toLowerCase(),
        body.bio,
        body.language,
        body.locale,
        body.timeZone,
        account.id,
      )
      .run();
    if (result.meta.changes !== 1) fail(401, "UNAUTHENTICATED");
  } catch (error) {
    if (uniqueConflict(error)) fail(409, "ACCOUNT_UNAVAILABLE");
    throw error;
  }
  const updated = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ? AND banned_at IS NULL",
  )
    .bind(account.id)
    .first<UserRow>();
  if (!updated) fail(401, "UNAUTHENTICATED");
  return c.json({ account: toAccount(updated) });
});

authRouter.post("/account/password", requireAuth, csrfGuard, async (c) => {
  const account = c.get("account");
  await throttle(c, `account:password:${account.id}`, 10, 3600);
  const body = await readJson(c, changePasswordSchema);
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ? AND banned_at IS NULL",
  )
    .bind(account.id)
    .first<UserRow>();
  if (!user) fail(401, "UNAUTHENTICATED");
  if (!(await verifyPassword(c, body.currentPassword, user.password_hash)))
    fail(401, "INVALID_CREDENTIALS");
  const hash = await passwordHash(c, body.password);
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ? AND banned_at IS NULL",
    ).bind(hash, account.id, user.password_hash),
    c.env.DB.prepare(
      "DELETE FROM sessions WHERE user_id = ? AND changes() > 0",
    ).bind(account.id),
  ]);
  clearSessionCookie(c);
  if (results[0].meta.changes !== 1) fail(401, "INVALID_CREDENTIALS");
  return c.json({});
});

authRouter.get("/players/:id", async (c) => {
  const parsed = z.uuid().safeParse(c.req.param("id"));
  if (!parsed.success) fail(404, "NOT_FOUND");
  const player = await c.env.DB.prepare(
    "SELECT id, username, bio, created_at FROM users WHERE id = ? AND banned_at IS NULL",
  )
    .bind(parsed.data)
    .first<Pick<UserRow, "id" | "username" | "bio" | "created_at">>();
  if (!player) fail(404, "NOT_FOUND");
  const viewer = c.get("account");
  let relationship = null;
  if (viewer && viewer.id !== player.id) {
    const state = await c.env.DB.prepare(
      "SELECT EXISTS(SELECT 1 FROM blocks WHERE blocker_id = ?1 AND blocked_id = ?2) AS by_me, EXISTS(SELECT 1 FROM blocks WHERE blocker_id = ?2 AND blocked_id = ?1) AS by_other",
    )
      .bind(viewer.id, player.id)
      .first<{ by_me: number; by_other: number }>();
    relationship = {
      blockedByMe: Boolean(state?.by_me),
      blockedByOther: Boolean(state?.by_other),
    };
  }
  return c.json({ player: toPlayer(player), relationship });
});

authRouter.get("/search", async (c) => {
  await throttle(c, `search:${c.get("account")?.id ?? requestKey(c)}`, 60, 60);
  const query = (c.req.query("q") ?? "").normalize("NFKC").trim().toLowerCase();
  if ([...query].length < 2 || [...query].length > 64)
    fail(400, "INVALID_INPUT");
  let cursor: z.infer<typeof searchCursorSchema> | null = null;
  const encoded = c.req.query("cursor");
  if (encoded) {
    try {
      if (encoded.length > 1024 || !/^[a-zA-Z0-9_-]+$/.test(encoded))
        fail(400, "INVALID_INPUT");
      const result = searchCursorSchema.safeParse(
        JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
      );
      if (!result.success) fail(400, "INVALID_INPUT");
      cursor = result.data;
    } catch {
      fail(400, "INVALID_INPUT");
    }
  }
  const result = cursor
    ? await c.env.DB.prepare(
        "SELECT id, username, username_key, bio, created_at FROM users WHERE banned_at IS NULL AND instr(username_key, ?) > 0 AND (username_key > ? OR (username_key = ? AND id > ?)) ORDER BY username_key, id LIMIT 21",
      )
        .bind(query, cursor.key, cursor.key, cursor.id)
        .all<UserRow>()
    : await c.env.DB.prepare(
        "SELECT id, username, username_key, bio, created_at FROM users WHERE banned_at IS NULL AND instr(username_key, ?) > 0 ORDER BY username_key, id LIMIT 21",
      )
        .bind(query)
        .all<UserRow>();
  const players = result.results.slice(0, 20);
  const last = players[players.length - 1];
  const response: SearchResponse = {
    players: players.map(toPlayer),
    nextCursor:
      result.results.length > 20 && last
        ? Buffer.from(
            JSON.stringify({ key: last.username_key, id: last.id }),
          ).toString("base64url")
        : null,
    categories: [
      { type: "players", available: true },
      { type: "teams", available: false },
      { type: "tournaments", available: false },
    ],
  };
  return c.json(response);
});
