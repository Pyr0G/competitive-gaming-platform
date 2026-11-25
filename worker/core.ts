import type { Context, MiddlewareHandler } from "hono";
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { deleteCookie, getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z, type ZodType } from "zod";
import {
  availabilityTimes,
  gamingRoles,
  maxSearchLength,
  minSearchLength,
  normalizeSearchQuery,
  spokenLanguages,
} from "../shared/contracts";
import type { Account, GamingProfile, Player } from "../shared/contracts";
import type { PasswordHasher } from "./passwords";

export interface Bindings {
  DB: D1Database;
  PASSWORD_HASHER: DurableObjectNamespace<PasswordHasher>;
  APP_ORIGIN?: string;
  LOCAL_DEV?: string;
  ASSETS: Fetcher;
}

export interface UserRow {
  id: string;
  username: string;
  username_key: string;
  email: string;
  email_key: string;
  password_hash: string;
  bio: string;
  language: "en" | "pl";
  locale: string;
  time_zone: string;
  is_admin: number;
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
  game_role: string | null;
  game_level: number | null;
  availability: string;
  spoken_languages: string;
}

export type GamingRow = Pick<
  UserRow,
  "game_role" | "game_level" | "availability" | "spoken_languages"
>;

export interface SessionRow {
  token_hash: string;
  csrf_token: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: { account: Account; session: SessionRow };
};

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
export const ADMIN_PAGE_SIZE = 25;
const adminCursorSchema = z.tuple([
  z.string().datetime({ precision: 3 }),
  z.string().uuid(),
]);

export const activeSessionSql = `FROM users JOIN sessions ON sessions.user_id = users.id
  WHERE users.id = ? AND sessions.token_hash = ? AND users.banned_at IS NULL
  AND sessions.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

export function fail(status: number, code: string): never {
  throw new HTTPException(status as ContentfulStatusCode, { message: code });
}

export function parseSearchQuery(value: string, allowEmpty = false): string {
  const query = normalizeSearchQuery(value);
  const length = [...query].length;
  if (
    length > maxSearchLength ||
    (length < minSearchLength && !(allowEmpty && length === 0))
  )
    fail(400, "INVALID_INPUT");
  return query;
}

export function decodeCursor<T>(
  encoded: string | undefined,
  schema: ZodType<T>,
): T | null {
  if (!encoded) return null;
  if (encoded.length > 1024 || !/^[a-zA-Z0-9_-]+$/.test(encoded))
    fail(400, "INVALID_INPUT");
  try {
    const result = schema.safeParse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
    if (!result.success) fail(400, "INVALID_INPUT");
    return result.data;
  } catch {
    fail(400, "INVALID_INPUT");
  }
}

export function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function adminCursor(value: string | undefined) {
  if (!value) return null;
  if (value.length > 128) fail(400, "INVALID_INPUT");
  const parsed = adminCursorSchema.safeParse(value.split("|"));
  if (!parsed.success) fail(400, "INVALID_INPUT");
  const [createdAt, id] = parsed.data;
  return { createdAt, id };
}

export function adminPage<T extends { id: string; created_at: string }>(
  rows: T[],
) {
  const page = rows.slice(0, ADMIN_PAGE_SIZE);
  const last = page.at(-1);
  return {
    rows: page,
    nextCursor:
      rows.length > ADMIN_PAGE_SIZE && last
        ? `${last.created_at}|${last.id}`
        : null,
  };
}

export function toPlayer(
  row: Pick<UserRow, "id" | "username" | "bio" | "created_at">,
): Player {
  return {
    id: row.id,
    username: row.username,
    bio: row.bio,
    createdAt: row.created_at,
  };
}

function knownValues<T extends string>(
  stored: string,
  allowed: readonly T[],
): T[] {
  try {
    const values: unknown = JSON.parse(stored);
    return Array.isArray(values)
      ? allowed.filter((value) => values.includes(value))
      : [];
  } catch {
    return [];
  }
}

export function toGaming(row: GamingRow): GamingProfile {
  return {
    role: gamingRoles.find((role) => role === row.game_role) ?? null,
    level: row.game_level,
    availability: knownValues(row.availability, availabilityTimes),
    languages: knownValues(row.spoken_languages, spokenLanguages),
  };
}

export function toAccount(row: UserRow): Account {
  return {
    ...toPlayer(row),
    email: row.email,
    language: row.language,
    locale: row.locale,
    timeZone: row.time_zone,
    isAdmin: row.is_admin === 1,
    gaming: toGaming(row),
  };
}

export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

export function runtimeSettings(c: Context<AppEnv>): {
  origin: string;
  secure: boolean;
  cookieName: string;
} {
  const requestUrl = new URL(c.req.url);
  if (c.env.LOCAL_DEV === "true") {
    if (
      !isLoopback(requestUrl.hostname) ||
      !["http:", "https:"].includes(requestUrl.protocol)
    ) {
      fail(503, "CONFIGURATION_ERROR");
    }
    return {
      origin: requestUrl.origin,
      secure: false,
      cookieName: "cgp_session",
    };
  }

  let configured: URL;
  try {
    configured = new URL(c.env.APP_ORIGIN ?? "");
  } catch {
    return fail(503, "CONFIGURATION_ERROR");
  }
  if (
    configured.protocol !== "https:" ||
    configured.origin !== c.env.APP_ORIGIN ||
    configured.username ||
    configured.password
  ) {
    fail(503, "CONFIGURATION_ERROR");
  }
  return {
    origin: configured.origin,
    secure: true,
    cookieName: "__Host-cgp_session",
  };
}

export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  const settings = runtimeSettings(c);
  await next();
  const scripts = settings.secure ? "'self'" : "'self' 'unsafe-inline'";
  const connections = settings.secure
    ? "'self'"
    : "'self' ws://localhost:* ws://127.0.0.1:* ws://[::1]:*";
  c.header(
    "Content-Security-Policy",
    `default-src 'none'; script-src ${scripts}; style-src 'self'${settings.secure ? "" : " 'unsafe-inline'"}; img-src 'self' data:; font-src 'self'; connect-src ${connections}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'`,
  );
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  if (settings.secure)
    c.header("Strict-Transport-Security", "max-age=31536000");
  if (new URL(c.req.url).pathname.startsWith("/api/"))
    c.header("Cache-Control", "no-store");
};

export const originGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    if (
      c.req.header("Origin") !== runtimeSettings(c).origin ||
      c.req.header("Sec-Fetch-Site") === "cross-site"
    ) {
      fail(403, "ORIGIN_DENIED");
    }
  }
  await next();
};

export function clearSessionCookie(c: Context<AppEnv>): void {
  const settings = runtimeSettings(c);
  deleteCookie(c, settings.cookieName, {
    path: "/",
    secure: settings.secure,
    httpOnly: true,
    sameSite: "Lax",
  });
}

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const settings = runtimeSettings(c);
  const token = getCookie(c, settings.cookieName);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (token) clearSessionCookie(c);
    await next();
    return;
  }

  const tokenHash = await sha256(token);
  const session = await c.env.DB.prepare(
    "SELECT token_hash, csrf_token, user_id, expires_at, created_at FROM sessions WHERE token_hash = ? AND expires_at > ?",
  )
    .bind(tokenHash, now())
    .first<SessionRow>();
  if (!session) {
    clearSessionCookie(c);
    await next();
    return;
  }

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(session.user_id)
    .first<UserRow>();
  if (!user || user.banned_at) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?")
      .bind(session.user_id)
      .run();
    clearSessionCookie(c);
    await next();
    return;
  }

  c.set("session", session);
  c.set("account", toAccount(user));
  await next();
};

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("account") || !c.get("session")) fail(401, "UNAUTHENTICATED");
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("account") || !c.get("session")) fail(401, "UNAUTHENTICATED");
  if (!c.get("account").isAdmin) fail(403, "FORBIDDEN");
  await next();
};

export const csrfGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const supplied = c.req.header("X-CSRF-Token");
  const expected = c.get("session")?.csrf_token;
  if (
    !supplied ||
    !expected ||
    !/^[a-f0-9]{64}$/.test(supplied) ||
    !/^[a-f0-9]{64}$/.test(expected) ||
    !timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"))
  )
    fail(403, "CSRF_INVALID");
  await next();
};

export async function readJson<T>(
  c: Context<AppEnv>,
  schema: ZodType<T>,
): Promise<T> {
  if (!/^application\/json(?:\s*;|$)/i.test(c.req.header("Content-Type") ?? ""))
    fail(415, "UNSUPPORTED_MEDIA_TYPE");
  const reader = c.req.raw.body?.getReader();
  if (!reader) fail(400, "INVALID_JSON");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > 16384) {
        await reader.cancel();
        fail(413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return fail(400, "INVALID_JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) fail(400, "INVALID_INPUT");
  return parsed.data;
}

export function requestKey(c: Context<AppEnv>): string {
  return c.env.LOCAL_DEV === "true"
    ? "local"
    : (c.req.header("CF-Connecting-IP") ?? "unknown");
}

export async function throttle(
  c: Context<AppEnv>,
  key: string,
  limit: number,
  windowSecs: number,
): Promise<void> {
  const seconds = Math.floor(Date.now() / 1000);
  const row = await c.env.DB.prepare(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
    reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
    RETURNING count, reset_at`,
  )
    .bind(await sha256(key), seconds + windowSecs, seconds, seconds)
    .first<{ count: number; reset_at: number }>();
  if (!row) fail(503, "SERVICE_UNAVAILABLE");
  if (row.count > limit) {
    c.header("Retry-After", String(Math.max(1, row.reset_at - seconds)));
    fail(429, "RATE_LIMITED");
  }
  if (row.count === 1) {
    await c.env.DB.prepare(
      "DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE reset_at < ? LIMIT 100)",
    )
      .bind(seconds)
      .run();
  }
}
