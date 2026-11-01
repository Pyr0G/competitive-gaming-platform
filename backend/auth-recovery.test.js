import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import { after, mock, test } from "node:test";
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";

const config = { jwtSecret: "test-only-session-key", appUrl: "http://localhost", production: false };
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
let user;
let resets;
let verification;
let failWrite = false;
let trace = [];
const query = async (sql, params) => {
    trace.push(sql);
    if (sql.startsWith("SELECT password_hash")) return { rows: user ? [{ password_hash: user.password_hash }] : [] };
    if (sql.startsWith("SELECT is_admin, banned_at")) return { rows: user ? [user] : [] };
    if (sql.includes("SELECT id, nick, email, password_hash")) return { rows: user ? [user] : [] };
    if (sql.includes("FROM users u LEFT JOIN teams")) return { rows: user ? [user] : [] };
    if (sql.includes("FROM advertisements a")) return { rows: [{ id: 1, mine: params[0] === 1 }] };
    if (sql.includes("SELECT u.id FROM users u JOIN password_resets")) {
        assert.match(sql, /FOR UPDATE OF u/);
        const token = resets.get(params[0]);
        return { rows: token && !token.used && !token.expired ? [{ id: 1 }] : [] };
    }
    if (sql.includes("SELECT u.id FROM users u JOIN email_verifications")) {
        assert.match(sql, /FOR UPDATE OF u/);
        return { rows: verification.used ? [] : [{ id: 1 }] };
    }
    if (sql.includes("UPDATE password_resets") && sql.includes("token_hash = $1")) {
        const token = resets.get(params[0]);
        if (!token || token.used || token.expired) return { rows: [] };
        token.used = true;
        return { rows: [{ user_id: 1 }] };
    }
    if (sql.startsWith("UPDATE users SET password_hash")) {
        user.password_hash = params[0];
        user.email_verified_at = new Date();
        if (failWrite) throw new Error("simulated database failure");
        return { rows: [] };
    }
    if (sql.startsWith("UPDATE password_resets")) {
        for (const token of resets.values()) token.used = true;
        return { rows: [] };
    }
    if (sql.includes("UPDATE email_verifications") && sql.includes("token_hash = $1")) {
        if (verification.used) return { rows: [] };
        verification.used = true;
        return { rows: [{ user_id: 1 }] };
    }
    if (sql.startsWith("UPDATE email_verifications")) {
        verification.used = true;
        return { rows: [] };
    }
    if (sql.startsWith("UPDATE users SET email_verified_at")) return { rows: [user] };
    if (sql.includes("WHERE c.id = $1")) return { rows: [{ id: 1, user_a_id: 1, user_b_id: 2, nick: "peer" }] };
    if (sql.includes("AS blocked,")) return { rows: [{ blocked: false, blocked_by: false }] };
    if (sql.includes("COUNT(*)")) return { rows: [{ n: 0 }] };
    return { rows: [] };
};

mock.module(new URL("./config.js", import.meta.url).href, { namedExports: { config } });
mock.module(new URL("./db.js", import.meta.url).href, { namedExports: {
    query,
    transaction: async (handler) => {
        const snapshot = structuredClone({ user, resets, verification });
        try { return await handler(query); }
        catch (err) {
            ({ user, resets, verification } = snapshot);
            throw err;
        }
    },
} });
mock.module(new URL("./mail.js", import.meta.url).href, { namedExports: { sendVerifyMail: async () => {}, sendResetMail: async () => {} } });
const { auth, readSession } = await import("./auth.js");
const { api } = await import("./api.js");
const { chat } = await import("./chat.js");
const { admin } = await import("./admin.js");
const app = express();
app.use(express.json());
app.use(readSession);
app.use("/api/auth", auth);
app.use("/api/chat", chat);
app.use("/api/admin", admin);
app.use("/api", api);
app.use((err, req, res, next) => res.status(500).json({ error: "test request failed" }));
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
after(() => new Promise((resolve) => server.close(resolve)));
const origin = `http://127.0.0.1:${server.address().port}`;
const request = (path, { body, cookie = "" } = {}) => fetch(`${origin}/api${path}`, {
    method: body ? "POST" : "GET", headers: { "content-type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined, redirect: "manual",
});
const login = () => request("/auth/login", { body: { login: "Bartek", password: "old-password" } });
const cookieOf = (response) => response.headers.get("set-cookie").split(";")[0];
const setup = async () => {
    user = { id: 1, nick: "Bartek", email: "bartek@example.com", password_hash: await bcrypt.hash("old-password", 10), email_verified_at: new Date(), is_admin: true, banned_at: null };
    resets = new Map(["first", "second", "expired"].map((token) => [hashToken(token), { used: false, expired: token === "expired" }]));
    verification = { used: false };
    failWrite = false;
    trace = [];
};

test("password recovery revokes existing sessions on protected and optional-auth endpoints", async () => {
    await setup();
    const cookie = cookieOf(await login());
    assert.equal((await (await request("/auth/me", { cookie })).json()).user.id, 1);
    assert.equal((await request("/chat/1", { cookie })).status, 200);
    assert.equal((await request("/admin/stats", { cookie })).status, 200);
    assert.equal((await request("/auth/reset", { body: { token: "first", password: "new-password" } })).status, 200);
    assert.equal((await (await request("/auth/me", { cookie })).json()).user, null);
    assert.equal((await request("/chat/1", { cookie })).status, 401);
    assert.equal((await request("/admin/stats", { cookie })).status, 401);
    assert.equal((await (await request("/ads", { cookie })).json()).ads[0].mine, false);
    assert.equal((await login()).status, 401);
    const fresh = await request("/auth/login", { body: { login: "Bartek", password: "new-password" } });
    assert.equal(fresh.status, 200);
    assert.equal((await request("/chat/1", { cookie: cookieOf(fresh) })).status, 200);
    assert.equal((await request("/auth/reset", { body: { token: "second", password: "another-password" } })).status, 400);
    assert.equal((await request("/auth/verify?token=old-verification")).headers.get("location"), "/?verified=0");
    assert.ok(trace.findIndex((sql) => sql.includes("FOR UPDATE OF u")) < trace.findIndex((sql) => sql.includes("UPDATE password_resets")));
});

test("activation issues a credential-bound session and rejects it after recovery", async () => {
    await setup();
    const activated = await request("/auth/verify?token=verification");
    assert.equal(activated.headers.get("location"), "/?verified=1");
    const cookie = cookieOf(activated);
    assert.equal((await request("/chat/1", { cookie })).status, 200);
    await request("/auth/reset", { body: { token: "first", password: "new-password" } });
    assert.equal((await request("/chat/1", { cookie })).status, 401);
});

test("invalid, expired and failed recoveries preserve the working password and token", async () => {
    await setup();
    const cookie = cookieOf(await login());
    for (const token of ["missing", "expired"]) {
        assert.equal((await request("/auth/reset", { body: { token, password: "new-password" } })).status, 400);
    }
    failWrite = true;
    assert.equal((await request("/auth/reset", { body: { token: "first", password: "new-password" } })).status, 500);
    assert.equal(resets.get(hashToken("first")).used, false);
    assert.ok(await bcrypt.compare("old-password", user.password_hash));
    assert.equal((await request("/chat/1", { cookie })).status, 200);
    failWrite = false;
    assert.equal((await request("/auth/reset", { body: { token: "first", password: "new-password" } })).status, 200);
});

test("legacy, malformed and deleted-account sessions fail closed", async () => {
    await setup();
    for (const payload of [{ id: 1 }, { id: "1", auth: "a".repeat(64) }, { id: 1, auth: ["a".repeat(64)] }, { id: 1, auth: "a".repeat(63) }]) {
        const cookie = `cgp_session=${jwt.sign(payload, config.jwtSecret)}`;
        assert.equal((await request("/chat/1", { cookie })).status, 401);
    }
    const cookie = cookieOf(await login());
    user = null;
    assert.equal((await (await request("/auth/me", { cookie })).json()).user, null);
});
