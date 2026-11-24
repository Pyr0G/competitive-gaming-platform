import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { SELF } from "cloudflare:test";
import {
  applyD1Migrations,
  createExecutionContext,
  reset,
  waitOnExecutionContext,
} from "cloudflare:test";
import app from "../worker/index";
import type {
  Account,
  AdminAction,
  AdminUser,
  AuthResponse,
  Message,
  Player,
  PlayerResponse,
  Report,
  SearchResponse,
  SyncResponse,
} from "../shared/contracts";

const origin = "http://127.0.0.1";
const password = "A long synthetic password 42!";

interface Client {
  account: Account;
  csrf: string;
  cookie: string;
}

async function request(
  path: string,
  method = "GET",
  data?: unknown,
  client?: Client,
  overrides?: Record<string, string>,
) {
  const headers = new Headers({ Origin: origin, ...overrides });
  if (data !== undefined) headers.set("Content-Type", "application/json");
  if (client) {
    headers.set("Cookie", client.cookie);
    headers.set("x-csrf-token", client.csrf);
  }
  return SELF.fetch(`${origin}/api${path}`, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

async function register(
  username: string,
  registrationPassword = password,
): Promise<Client> {
  const response = await request("/auth/register", "POST", {
    username,
    email: `${username.toLowerCase()}@example.com`,
    password: registrationPassword,
    passwordConfirmation: registrationPassword,
    language: "en",
    locale: "en-GB",
    timeZone: "UTC",
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as AuthResponse;
  expect(body.account).not.toBeNull();
  return {
    account: body.account!,
    csrf: body.csrfToken!,
    cookie: response.headers.get("set-cookie")!.split(";")[0],
  };
}

async function login(
  identifier: string,
  loginPassword = password,
): Promise<Client> {
  const response = await request("/auth/login", "POST", {
    identifier,
    password: loginPassword,
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as AuthResponse;
  return {
    account: body.account!,
    csrf: body.csrfToken!,
    cookie: response.headers.get("set-cookie")!.split(";")[0],
  };
}

async function grantAdmin(client: Client) {
  await env.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?")
    .bind(client.account.id)
    .run();
}

async function openConversation(a: Client, b: Client) {
  const response = await request(
    "/conversations",
    "POST",
    { playerId: b.account.id },
    a,
  );
  expect([200, 201]).toContain(response.status);
  return ((await response.json()) as { conversationId: string }).conversationId;
}

async function send(
  client: Client,
  conversationId: string,
  body = "Hello from a synthetic account",
  clientId = crypto.randomUUID(),
) {
  const response = await request(
    `/conversations/${conversationId}/messages`,
    "POST",
    { body, clientId },
    client,
  );
  expect([200, 201]).toContain(response.status);
  return ((await response.json()) as { message: Message }).message;
}

describe("accounts and public boundaries", () => {
  it("creates an active account with a hashed password and an HttpOnly session", async () => {
    const user = await register("PlayerOne");
    const row = await env.DB.prepare(
      "SELECT password_hash, is_admin FROM users WHERE id = ?",
    )
      .bind(user.account.id)
      .first<{ password_hash: string; is_admin: number }>();
    expect(row!.password_hash).toMatch(/^scrypt\$/);
    expect(row!.password_hash).not.toContain(password);
    expect(row!.is_admin).toBe(0);
    const response = await request("/auth/me", "GET", undefined, user);
    const me = (await response.json()) as AuthResponse;
    expect(me.account?.id).toBe(user.account.id);
    const session = await env.DB.prepare(
      "SELECT token_hash FROM sessions WHERE user_id = ?",
    )
      .bind(user.account.id)
      .first<{ token_hash: string }>();
    expect(session!.token_hash).not.toBe(user.cookie.split("=")[1]);
    const signedIn = await request("/auth/login", "POST", {
      identifier: "playerone@example.com",
      password,
    });
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(signedIn.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
  });

  it("accepts Unicode usernames, preserves Unicode passwords and normalizes identifier uniqueness", async () => {
    const response = await request("/auth/register", "POST", {
      username: "Łukasz",
      email: "unicode@example.com",
      password: "Zażółć gęślą jaźń 12345",
      passwordConfirmation: "Zażółć gęślą jaźń 12345",
    });
    expect(response.status).toBe(201);
    const signedIn = await login("łukasz", "Zażółć gęślą jaźń 12345");
    expect(signedIn.account.username).toBe("Łukasz");
    const duplicate = await request("/auth/register", "POST", {
      username: "ŁUKASZ",
      email: "other@example.com",
      password,
      passwordConfirmation: password,
    });
    expect(duplicate.status).toBe(409);
  });

  it("rejects mismatches, short passwords and privileged registration fields", async () => {
    const base = {
      username: "PlayerOne",
      email: "player@example.com",
      password,
      passwordConfirmation: password,
    };
    for (const change of [
      { passwordConfirmation: "different" },
      { password: "Seven7!", passwordConfirmation: "Seven7!" },
      { isAdmin: true },
    ]) {
      expect(
        (await request("/auth/register", "POST", { ...base, ...change }))
          .status,
      ).toBe(400);
    }
    expect(
      (await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{
        count: number;
      }>())!.count,
    ).toBe(0);
  });

  it("accepts an eight-character password and authenticates with it", async () => {
    const user = await register("EightPlayer", "Eight42!");
    const signedIn = await login("EightPlayer", "Eight42!");
    expect(signedIn.account.id).toBe(user.account.id);
  });

  it("rejects cross-origin writes and missing CSRF tokens", async () => {
    const user = await register("PlayerOne");
    const update = {
      username: "PlayerOne",
      bio: "A short bio",
      language: "pl",
      locale: "pl-PL",
      timeZone: "Europe/Warsaw",
    };
    expect(
      (
        await request("/account", "PATCH", update, user, {
          Origin: "https://example.net",
        })
      ).status,
    ).toBe(403);
    const withoutCsrf = await SELF.fetch(`${origin}/api/account`, {
      method: "PATCH",
      headers: {
        Origin: origin,
        Cookie: user.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(update),
    });
    expect(withoutCsrf.status).toBe(403);
    expect(
      (await request("/account", "PATCH", { ...update, isAdmin: true }, user))
        .status,
    ).toBe(400);
  });

  it("edits core settings while public search and profiles omit private fields", async () => {
    const user = await register("PlayerOne");
    const response = await request(
      "/account",
      "PATCH",
      {
        username: "NowyGracz",
        bio: "<script>alert(1)</script>",
        language: "pl",
        locale: "pl-PL",
        timeZone: "Europe/Warsaw",
      },
      user,
    );
    expect(response.status).toBe(200);
    const profile = await request(`/players/${user.account.id}`);
    const publicBody = (await profile.json()) as { player: Player };
    expect(publicBody.player.username).toBe("NowyGracz");
    expect(Object.keys(publicBody.player).sort()).toEqual([
      "bio",
      "createdAt",
      "id",
      "username",
    ]);
    const found = (await (
      await request("/search?q=nowy")
    ).json()) as SearchResponse;
    expect(found.players.map((p) => p.id)).toEqual([user.account.id]);
    expect(
      found.categories.filter((c) => c.available).map((c) => c.type),
    ).toEqual(["players"]);
    expect(JSON.stringify(found)).not.toContain(user.account.email);
    const literal = (await (
      await request("/search?q=%25_")
    ).json()) as SearchResponse;
    expect(literal.players).toEqual([]);
  });

  it("saves self-declared gaming details and shows them on the public profile", async () => {
    const user = await register("GamingPlayer");
    expect(user.account.gaming).toEqual({
      role: null,
      level: null,
      availability: [],
      languages: [],
    });
    const empty = (await (
      await request(`/players/${user.account.id}`)
    ).json()) as PlayerResponse;
    expect(empty.gaming.availability).toEqual([]);
    const response = await request(
      "/account/gaming",
      "PUT",
      {
        role: "awp",
        level: 8,
        availability: ["weekends", "evenings"],
        languages: ["pl", "en"],
      },
      user,
    );
    expect(response.status).toBe(200);
    const saved = (await response.json()) as { account: Account };
    expect(saved.account.gaming).toEqual({
      role: "awp",
      level: 8,
      availability: ["evenings", "weekends"],
      languages: ["en", "pl"],
    });
    expect(saved.account.language).toBe("en");
    const profile = (await (
      await request(`/players/${user.account.id}`)
    ).json()) as PlayerResponse;
    expect(profile.gaming).toEqual(saved.account.gaming);
    expect(Object.keys(profile.player).sort()).toEqual([
      "bio",
      "createdAt",
      "id",
      "username",
    ]);
    expect(JSON.stringify(profile)).not.toContain(user.account.email);
    const me = (await (
      await request("/auth/me", "GET", undefined, user)
    ).json()) as AuthResponse;
    expect(me.account?.gaming).toEqual(saved.account.gaming);
    const cleared = await request(
      "/account/gaming",
      "PUT",
      { role: null, level: null, availability: [], languages: [] },
      user,
    );
    expect(
      ((await cleared.json()) as { account: Account }).account.gaming,
    ).toEqual({ role: null, level: null, availability: [], languages: [] });
  });

  it("rejects invalid gaming details and unauthorized gaming updates", async () => {
    const user = await register("StrictGamer");
    const valid = {
      role: "igl",
      level: 5,
      availability: ["daytime"],
      languages: ["de"],
    };
    for (const invalid of [
      { ...valid, role: "sniper" },
      { ...valid, level: 0 },
      { ...valid, level: 11 },
      { ...valid, level: 5.5 },
      { ...valid, availability: ["evenings", "evenings"] },
      { ...valid, availability: ["always"] },
      { ...valid, languages: ["en", "pl", "de", "fr", "es", "it"] },
      { ...valid, languages: ["xx"] },
      { ...valid, isAdmin: true },
      { role: "igl" },
    ]) {
      expect(
        (await request("/account/gaming", "PUT", invalid, user)).status,
      ).toBe(400);
    }
    expect((await request("/account/gaming", "PUT", valid)).status).toBe(401);
    const withoutCsrf = await SELF.fetch(`${origin}/api/account/gaming`, {
      method: "PUT",
      headers: {
        Origin: origin,
        Cookie: user.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(valid),
    });
    expect(withoutCsrf.status).toBe(403);
    expect(
      (
        await request("/account/gaming", "PUT", valid, user, {
          Origin: "https://example.net",
        })
      ).status,
    ).toBe(403);
    const row = await env.DB.prepare(
      "SELECT game_role, game_level, availability, spoken_languages FROM users WHERE id = ?",
    )
      .bind(user.account.id)
      .first();
    expect(row).toEqual({
      game_role: null,
      game_level: null,
      availability: "[]",
      spoken_languages: "[]",
    });
    await env.DB.prepare("UPDATE users SET banned_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), user.account.id)
      .run();
    expect((await request("/account/gaming", "PUT", valid, user)).status).toBe(
      401,
    );
  });

  it("enforces gaming profile constraints in storage", async () => {
    const user = await register("StoredGamer");
    for (const statement of [
      "UPDATE users SET game_role = 'sniper' WHERE id = ?",
      "UPDATE users SET game_level = 11 WHERE id = ?",
      "UPDATE users SET availability = 'evenings' WHERE id = ?",
      "UPDATE users SET spoken_languages = '{}' WHERE id = ?",
    ]) {
      await expect(
        env.DB.prepare(statement).bind(user.account.id).run(),
      ).rejects.toThrow();
    }
  });

  it("searches long Unicode terms and treats SQL pattern characters literally", async () => {
    const username = "界".repeat(20);
    const user = await register("UnicodePlayer");
    expect(
      (
        await request(
          "/account",
          "PATCH",
          {
            username,
            bio: "",
            language: "en",
            locale: "en-GB",
            timeZone: "UTC",
          },
          user,
        )
      ).status,
    ).toBe(200);
    for (const query of [
      username,
      "a".repeat(64),
      "界".repeat(64),
      "%_",
      "__",
      "\\\\",
    ]) {
      const response = await request(`/search?q=${encodeURIComponent(query)}`);
      expect(response.status).toBe(200);
      const result = (await response.json()) as SearchResponse;
      expect(result.players.map((player) => player.id)).toEqual(
        query === username ? [user.account.id] : [],
      );
    }
    expect((await request(`/search?q=${"a".repeat(65)}`)).status).toBe(400);
    const cursor = Buffer.from(
      JSON.stringify({ key: "", id: crypto.randomUUID() }),
    ).toString("base64url");
    const response = await request(
      `/search?q=${encodeURIComponent(username)}&cursor=${cursor}`,
    );
    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as SearchResponse).players.map(
        (player) => player.id,
      ),
    ).toEqual([user.account.id]);
  });

  it("invalidates existing sessions after password change and logout", async () => {
    const first = await register("PlayerOne");
    const second = await login("PlayerOne");
    const nextPassword = "Next123!";
    expect(
      (
        await request(
          "/account/password",
          "POST",
          {
            currentPassword: password,
            password: "Seven7!",
            passwordConfirmation: "Seven7!",
          },
          first,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "/account/password",
          "POST",
          {
            currentPassword: password,
            password: nextPassword,
            passwordConfirmation: nextPassword,
          },
          first,
        )
      ).status,
    ).toBe(200);
    for (const old of [first, second]) {
      expect(
        (
          (await (
            await request("/auth/me", "GET", undefined, old)
          ).json()) as AuthResponse
        ).account,
      ).toBeNull();
    }
    expect(
      (
        await request("/auth/login", "POST", {
          identifier: "PlayerOne",
          password,
        })
      ).status,
    ).toBe(401);
    const current = await login("PlayerOne", nextPassword);
    expect((await request("/auth/logout", "POST", {}, current)).status).toBe(
      200,
    );
    expect(
      (
        (await (
          await request("/auth/me", "GET", undefined, current)
        ).json()) as AuthResponse
      ).account,
    ).toBeNull();
  });

  it("returns generic authentication failures and persists throttles in SQLite", async () => {
    for (let i = 0; i < 30; i++) {
      const response = await request("/auth/login", "POST", {
        identifier: "missing",
        password,
      });
      if (response.status === 429) {
        expect(response.headers.get("retry-after")).not.toBeNull();
        const limits = await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM rate_limits",
        ).first<{ count: number }>();
        expect(limits!.count).toBeGreaterThan(0);
        return;
      }
      expect(response.status).toBe(401);
    }
    throw new Error("Authentication was not throttled");
  });

  it("rejects duplicate email addresses and oversized or non-JSON input", async () => {
    await register("PlayerOne");
    const duplicate = await request("/auth/register", "POST", {
      username: "DifferentPlayer",
      email: "PLAYERONE@example.com",
      password,
      passwordConfirmation: password,
    });
    expect(duplicate.status).toBe(409);
    const oversized = await request("/auth/login", "POST", {
      identifier: "x".repeat(17000),
      password,
    });
    expect(oversized.status).toBe(413);
    const mediaType = await SELF.fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "text/plain" },
      body: "{}",
    });
    expect(mediaType.status).toBe(415);
  });

  it("fails closed when the password service is unavailable or production is unconfigured", async () => {
    const ctx = createExecutionContext();
    const failedHasher = {
      getByName: () => {
        throw new Error("Synthetic service failure");
      },
    } as unknown as typeof env.PASSWORD_HASHER;
    const response = await app.fetch(
      new Request(`${origin}/api/auth/register`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "PlayerOne",
          email: "player@example.com",
          password,
          passwordConfirmation: password,
        }),
      }),
      { ...env, PASSWORD_HASHER: failedHasher },
      ctx,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Synthetic");
    expect(
      (await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{
        count: number;
      }>())!.count,
    ).toBe(0);
    const unconfigured = await app.fetch(
      new Request("https://cgp.example.com/api/auth/me"),
      { ...env, LOCAL_DEV: undefined, APP_ORIGIN: undefined },
      ctx,
    );
    expect(unconfigured.status).toBe(503);
    await waitOnExecutionContext(ctx);
  });

  it("uses secure host-only session cookies and strict headers with an explicit HTTPS origin", async () => {
    const productionOrigin = "https://cgp.example.com";
    const ctx = createExecutionContext();
    const response = await app.fetch(
      new Request(`${productionOrigin}/api/auth/register`, {
        method: "POST",
        headers: {
          Origin: productionOrigin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "PlayerOne",
          email: "player@example.com",
          password,
          passwordConfirmation: password,
        }),
      }),
      { ...env, LOCAL_DEV: undefined, APP_ORIGIN: productionOrigin },
      ctx,
    );
    expect(response.status).toBe(201);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^__Host-cgp_session=/);
    expect(cookie).toMatch(/; Secure/i);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(response.headers.get("content-security-policy")).not.toContain(
      "unsafe-inline",
    );
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    await waitOnExecutionContext(ctx);
  });
});

describe("static asset security", () => {
  it("applies document security headers to raw asset-binding responses", async () => {
    const ctx = createExecutionContext();
    const assets = {
      fetch: async () =>
        new Response("<!doctype html><title>CGP</title>", {
          headers: { "Content-Type": "text/html" },
        }),
    } as unknown as Fetcher;
    const response = await app.fetch(
      new Request("https://cgp.example.com/"),
      {
        ...env,
        LOCAL_DEV: undefined,
        APP_ORIGIN: "https://cgp.example.com",
        ASSETS: assets,
      },
      ctx,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers.get("content-security-policy")).not.toContain(
      "unsafe-inline",
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await waitOnExecutionContext(ctx);
  });
});

describe("private conversations and moderation", () => {
  it("limits synchronization per account across sessions without affecting another account", async () => {
    const a = await register("PlayerOne");
    const b = await register("PlayerTwo");
    for (let i = 0; i < 60; i++)
      expect((await request("/sync", "GET", undefined, a)).status).toBe(200);
    const retry = await request("/sync", "GET", undefined, a);
    expect(retry.status).toBe(429);
    expect(Number(retry.headers.get("retry-after"))).toBeGreaterThan(0);
    const anotherSession = await login("PlayerOne");
    expect(
      (await request("/sync", "GET", undefined, anotherSession)).status,
    ).toBe(429);
    expect((await request("/sync", "GET", undefined, b)).status).toBe(200);
  });

  it("backfills inbox state while preserving existing messages and read positions", async () => {
    await reset();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, 1));
    const a = await register("PlayerOne");
    const b = await register("PlayerTwo");
    const id = await openConversation(a, b);
    const first = await send(a, id, "Read before migration");
    await send(a, id, "Unread before migration");
    expect(
      (
        await request(
          `/conversations/${id}/read`,
          "POST",
          { messageId: first.id },
          b,
        )
      ).status,
    ).toBe(200);
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(1));
    const inbox = (await (
      await request(`/sync?conversationId=${id}`, "GET", undefined, b)
    ).json()) as SyncResponse;
    expect(inbox.messages).toHaveLength(2);
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.conversations[0].unreadCount).toBe(1);
    const next = await send(a, id, "Unread after migration");
    expect(
      (
        await request(
          `/conversations/${id}/read`,
          "POST",
          { messageId: next.id },
          b,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        (await (
          await request("/sync", "GET", undefined, b)
        ).json()) as SyncResponse
      ).unreadCount,
    ).toBe(0);
  });

  it("keeps synchronization database reads bounded as unread history grows", async () => {
    const a = await register("PlayerOne");
    const b = await register("PlayerTwo");
    const id = await openConversation(a, b);
    async function seed(from: number, to: number) {
      await env.DB.prepare(
        "WITH RECURSIVE x(n) AS (SELECT ?1 UNION ALL SELECT n+1 FROM x WHERE n < ?2) INSERT INTO messages(conversation_id,sender_id,body,client_id) SELECT ?3,?4,'Synthetic history',CAST(n AS TEXT) FROM x",
      )
        .bind(from, to, id, a.account.id)
        .run();
    }
    async function measure(expectedUnread: number) {
      let rowsRead = 0;
      const db = {
        prepare: (query: string) => env.DB.prepare(query),
        batch: async <T>(statements: D1PreparedStatement[]) => {
          const results = await env.DB.batch<T>(statements);
          rowsRead += results.reduce(
            (sum, result) => sum + result.meta.rows_read,
            0,
          );
          return results;
        },
      } as D1Database;
      const ctx = createExecutionContext();
      const response = await app.fetch(
        new Request(`${origin}/api/sync`, { headers: { Cookie: b.cookie } }),
        { ...env, DB: db },
        ctx,
      );
      expect(response.status).toBe(200);
      const inbox = (await response.json()) as SyncResponse;
      expect(inbox.unreadCount).toBe(expectedUnread);
      expect(inbox.conversations[0].unreadCount).toBe(expectedUnread);
      await waitOnExecutionContext(ctx);
      return rowsRead;
    }
    await seed(1, 100);
    const small = await measure(100);
    await seed(101, 10000);
    const large = await measure(10000);
    expect(large).toBeLessThanOrEqual(small + 10);
    expect(large).toBeLessThan(100);
    async function seedConversations(from: number, to: number) {
      await env.DB.prepare(
        "WITH RECURSIVE x(n) AS (SELECT ?1 UNION ALL SELECT n+1 FROM x WHERE n < ?2) INSERT INTO users(id,username,username_key,email,email_key,password_hash) SELECT printf('00000000-0000-4000-8000-%012d',n),'InboxPeer'||n,'inboxpeer'||n,'peer'||n||'@example.com','peer'||n||'@example.com','synthetic' FROM x",
      )
        .bind(from, to)
        .run();
      await env.DB.prepare(
        "WITH RECURSIVE x(n) AS (SELECT ?1 UNION ALL SELECT n+1 FROM x WHERE n < ?2) INSERT INTO conversations(id,user_low,user_high) SELECT printf('10000000-0000-4000-8000-%012d',n),MIN(printf('00000000-0000-4000-8000-%012d',n),?3),MAX(printf('00000000-0000-4000-8000-%012d',n),?3) FROM x",
      )
        .bind(from, to, b.account.id)
        .run();
    }
    await seedConversations(1, 150);
    const many = await measure(10000);
    await seedConversations(151, 600);
    const more = await measure(10000);
    expect(more).toBeLessThanOrEqual(many + 10);
    expect(more).toBeLessThan(2000);
    const selected = "10000000-0000-4000-8000-000000000001";
    const outsideRecent = (await (
      await request(`/sync?conversationId=${selected}`, "GET", undefined, b)
    ).json()) as SyncResponse;
    expect(outsideRecent.conversations).toHaveLength(101);
    expect(
      outsideRecent.conversations.some((item) => item.id === selected),
    ).toBe(true);
    expect(outsideRecent.messages).toEqual([]);
    expect(outsideRecent.unreadCount).toBe(10000);
  });

  it("maintains exact unread counts during message retries and concurrent reads", async () => {
    const a = await register("PlayerOne");
    const b = await register("PlayerTwo");
    const id = await openConversation(a, b);
    const first = await send(a, id, "First");
    const clientId = crypto.randomUUID();
    const [second] = await Promise.all([
      send(a, id, "Second", clientId),
      send(a, id, "Second", clientId),
    ]);
    const otherDirection = await send(b, id, "Reply");
    await Promise.all([
      request(`/conversations/${id}/read`, "POST", { messageId: first.id }, b),
      request(`/conversations/${id}/read`, "POST", { messageId: second.id }, b),
      send(a, id, "Third"),
    ]);
    const inbox = (await (
      await request("/sync", "GET", undefined, b)
    ).json()) as SyncResponse;
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.conversations[0].unreadCount).toBe(1);
    const senderInbox = (await (
      await request("/sync", "GET", undefined, a)
    ).json()) as SyncResponse;
    expect(senderInbox.unreadCount).toBe(1);
    await request(
      `/conversations/${id}/read`,
      "POST",
      { messageId: otherDirection.id },
      a,
    );
    expect(
      (
        (await (
          await request("/sync", "GET", undefined, a)
        ).json()) as SyncResponse
      ).unreadCount,
    ).toBe(0);
  });

  it("deduplicates concurrent conversation creation and message retries", async () => {
    const a = await register("PlayerOne");
    const b = await register("PlayerTwo");
    const ids = await Promise.all([
      openConversation(a, b),
      openConversation(b, a),
    ]);
    expect(ids[0]).toBe(ids[1]);
    const clientId = crypto.randomUUID();
    const first = await send(a, ids[0], "Hello", clientId);
    const retry = await send(a, ids[0], "Hello", clientId);
    expect(retry.id).toBe(first.id);
    const inbox = (await (
      await request(`/sync?conversationId=${ids[0]}`, "GET", undefined, b)
    ).json()) as SyncResponse;
    expect(inbox.messages).toHaveLength(1);
    expect(inbox.unreadCount).toBe(1);
  });

  it("denies nonparticipants access to messages, sends, reads and reports", async () => {
    const a = await register("PlayerOne");
    const b = await register("PlayerTwo");
    const outsider = await register("Outsider");
    const id = await openConversation(a, b);
    const message = await send(a, id);
    for (const [path, method, body] of [
      [`/conversations/${id}/messages`, "GET", undefined],
      [
        `/conversations/${id}/messages`,
        "POST",
        { body: "Intrusion", clientId: crypto.randomUUID() },
      ],
      [`/conversations/${id}/read`, "POST", { messageId: message.id }],
      [
        "/reports",
        "POST",
        { messageId: message.id, reason: "Unrelated report" },
      ],
      [`/sync?conversationId=${id}`, "GET", undefined],
    ] as const) {
      expect([403, 404]).toContain(
        (await request(path, method, body, outsider)).status,
      );
    }
    expect((await request("/sync")).status).toBe(401);
  });

  it("keeps read positions monotonic and scoped to their conversation", async () => {
    const a = await register("PlayerOne");
    const b = await register("PlayerTwo");
    const c = await register("PlayerThree");
    const id = await openConversation(a, b);
    const first = await send(a, id, "First");
    const second = await send(a, id, "Second");
    for (const messageId of [second.id, first.id])
      expect(
        (await request(`/conversations/${id}/read`, "POST", { messageId }, b))
          .status,
      ).toBe(200);
    expect(
      (
        (await (
          await request("/sync", "GET", undefined, b)
        ).json()) as SyncResponse
      ).unreadCount,
    ).toBe(0);
    const other = await openConversation(a, c);
    const unrelated = await send(a, other);
    expect([400, 404]).toContain(
      (
        await request(
          `/conversations/${id}/read`,
          "POST",
          { messageId: unrelated.id },
          b,
        )
      ).status,
    );
  });

  it("preserves history while blocking messages in both directions", async () => {
    const a = await register("PlayerOne");
    const b = await register("PlayerTwo");
    const id = await openConversation(a, b);
    await send(a, id);
    expect(
      (await request(`/blocks/${b.account.id}`, "PUT", {}, a)).status,
    ).toBe(200);
    for (const sender of [a, b])
      expect(
        (
          await request(
            `/conversations/${id}/messages`,
            "POST",
            { body: "Blocked", clientId: crypto.randomUUID() },
            sender,
          )
        ).status,
      ).toBe(403);
    const history = (await (
      await request(`/conversations/${id}/messages`, "GET", undefined, b)
    ).json()) as { messages: Message[] };
    expect(history.messages).toHaveLength(1);
    expect(
      (await request(`/blocks/${b.account.id}`, "DELETE", undefined, a)).status,
    ).toBe(200);
    await send(b, id, "Unblocked");
  });

  it("paginates history and message deltas without losing equal-timestamp messages", async () => {
    const a = await register("PlayerOne");
    const b = await register("PlayerTwo");
    const id = await openConversation(a, b);
    await env.DB.batch(
      Array.from({ length: 55 }, (_, i) =>
        env.DB.prepare(
          "INSERT INTO messages(conversation_id,sender_id,body,client_id,created_at) VALUES (?,?,?,?,?)",
        ).bind(
          id,
          a.account.id,
          `Message ${i}`,
          crypto.randomUUID(),
          "2026-01-01T00:00:00.000Z",
        ),
      ),
    );
    const recent = (await (
      await request(`/sync?conversationId=${id}`, "GET", undefined, b)
    ).json()) as SyncResponse;
    expect(recent.messages).toHaveLength(50);
    expect(recent.hasMore).toBe(true);
    const older = (await (
      await request(
        `/conversations/${id}/messages?before=${recent.messages[0].id}`,
        "GET",
        undefined,
        b,
      )
    ).json()) as { messages: Message[]; hasMore: boolean };
    expect(older.messages).toHaveLength(5);
    expect(older.hasMore).toBe(false);
    const allIds = [...older.messages, ...recent.messages].map((m) => m.id);
    expect(new Set(allIds).size).toBe(55);
    const next = await send(a, id, "A newer message");
    const delta = (await (
      await request(
        `/sync?conversationId=${id}&after=${recent.messages.at(-1)!.id}`,
        "GET",
        undefined,
        b,
      )
    ).json()) as SyncResponse;
    expect(delta.messages.map((m) => m.id)).toEqual([next.id]);
  });

  it("allows only admins to review bounded report evidence and resolve reports", async () => {
    const a = await register("PlayerOne");
    const b = await register("PlayerTwo");
    const admin = await register("Moderator");
    await grantAdmin(admin);
    const id = await openConversation(a, b);
    let message: Message | undefined;
    for (let i = 0; i < 8; i++) message = await send(a, id, `Context ${i}`);
    expect(
      (
        await request(
          "/reports",
          "POST",
          { messageId: message!.id, reason: "Abusive message for review" },
          b,
        )
      ).status,
    ).toBe(201);
    expect((await request("/admin/reports", "GET", undefined, a)).status).toBe(
      403,
    );
    const reports = (await (
      await request("/admin/reports", "GET", undefined, admin)
    ).json()) as { reports: Report[] };
    expect(reports.reports).toHaveLength(1);
    expect(reports.reports[0].evidence).toHaveLength(6);
    expect(reports.reports[0].evidence.at(-1)!.id).toBe(message!.id);
    expect(
      (await request(`/conversations/${id}/messages`, "GET", undefined, admin))
        .status,
    ).toBe(404);
    expect(
      (
        await request(
          `/admin/reports/${reports.reports[0].id}/resolve`,
          "POST",
          { reason: "Reviewed with a warning" },
          admin,
        )
      ).status,
    ).toBe(200);
    const actions = (await (
      await request("/admin/actions", "GET", undefined, admin)
    ).json()) as { actions: AdminAction[] };
    expect(actions.actions[0].action).toBe("resolve_report");
  });

  it("enforces manual-only roles, immediate bans and immediate admin revocation", async () => {
    const admin = await register("Moderator");
    const user = await register("PlayerOne");
    const anotherAdmin = await register("AnotherAdmin");
    await grantAdmin(admin);
    await grantAdmin(anotherAdmin);
    expect(
      (
        await request(
          `/admin/users/${user.account.id}/admin`,
          "POST",
          { on: true },
          admin,
        )
      ).status,
    ).toBe(404);
    for (const target of [admin, anotherAdmin])
      expect([403, 409]).toContain(
        (
          await request(
            `/admin/users/${target.account.id}/ban`,
            "POST",
            { reason: "Must be rejected" },
            admin,
          )
        ).status,
      );
    expect(
      (
        await request(
          `/admin/users/${user.account.id}/ban`,
          "POST",
          { reason: "Repeated abusive messages" },
          admin,
        )
      ).status,
    ).toBe(200);
    expect((await request("/sync", "GET", undefined, user)).status).toBe(401);
    expect(
      (
        await request("/auth/login", "POST", {
          identifier: "PlayerOne",
          password,
        })
      ).status,
    ).toBe(403);
    expect((await request(`/players/${user.account.id}`)).status).toBe(404);
    const search = (await (
      await request("/search?q=player")
    ).json()) as SearchResponse;
    expect(search.players).toEqual([]);
    const users = (await (
      await request("/admin/users", "GET", undefined, admin)
    ).json()) as { users: AdminUser[] };
    expect(
      users.users.find((u) => u.id === user.account.id)?.bannedAt,
    ).not.toBeNull();
    expect(
      (
        await request(
          `/admin/users/${user.account.id}/unban`,
          "POST",
          { reason: "Appeal accepted" },
          admin,
        )
      ).status,
    ).toBe(200);
    await login("PlayerOne");
    await env.DB.prepare("UPDATE users SET is_admin = 0 WHERE id = ?")
      .bind(admin.account.id)
      .run();
    expect(
      (await request("/admin/users", "GET", undefined, admin)).status,
    ).toBe(403);
  });

  it("hashes and verifies only through the actual private Durable Object", async () => {
    const stub = env.PASSWORD_HASHER.getByName("test-passwords");
    const a = await stub.hash(password);
    const b = await stub.hash(password);
    expect(a).not.toBe(b);
    expect(await stub.verify(password, a)).toBe(true);
    expect(await stub.verify(`${password}wrong`, a)).toBe(false);
    expect(await stub.verify(password, "malformed")).toBe(false);
    expect(
      (await request("/passwords/hash", "POST", { password })).status,
    ).toBe(404);
  });
});
