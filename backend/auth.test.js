import assert from "node:assert/strict";
import { once } from "node:events";
import { after, mock, test } from "node:test";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const config = { jwtSecret: "test-only-session-key", appUrl: "http://localhost", production: false };
let queryHandler = async () => ({ rows: [] });
mock.module(new URL("./config.js", import.meta.url).href, { namedExports: { config } });
mock.module(new URL("./db.js", import.meta.url).href, { namedExports: { query: (...args) => queryHandler(...args) } });
mock.module(new URL("./mail.js", import.meta.url).href, {
    namedExports: { sendVerifyMail: async () => {}, sendResetMail: async () => {} },
});
const { auth, readSession } = await import("./auth.js");
const { api } = await import("./api.js");
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(readSession);
app.use("/api/auth", auth);
app.use("/api", api);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
after(() => new Promise((resolve) => server.close(resolve)));
const origin = `http://127.0.0.1:${server.address().port}`;

const post = (path, body = {}, ip = "192.0.2.1", cookie = "") => fetch(`${origin}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, cookie },
    body: JSON.stringify(body),
});

test("actual auth and ads routes keep one allowance across route aliases", async () => {
    const cookie = `cgp_session=${jwt.sign({ id: 1 }, config.jwtSecret)}`;
    const routes = [
        ["register", 10, {}, 400], ["login", 20, {}, 400],
        ["resend", 5, {}, 200], ["forgot", 5, {}, 400], ["reset", 10, {}, 400],
    ];
    for (const [operation, max, body, admitted] of routes) {
        for (let i = 0; i < max; i++) {
            const path = i % 2 ? `/AUTH/${operation.toUpperCase()}/` : `/auth/${operation}`;
            assert.equal((await post(path, body)).status, admitted, path);
        }
        assert.equal((await post(`/auth/${operation}/`, body)).status, 429, operation);
    }
    for (let i = 0; i < 10; i++) {
        assert.equal((await post(i % 2 ? "/ADS/" : "/ads", {}, "192.0.2.1", cookie)).status, 400);
    }
    assert.equal((await post("/Ads/", {}, "192.0.2.1", cookie)).status, 429);
    assert.equal((await post("/ads", {}, "192.0.2.2")).status, 401);
});

test("registration, login and reset preserve legitimate password and session behavior", async () => {
    const user = { id: 1, nick: "tester", email: "tester@example.com", email_verified_at: new Date() };
    let passwordHash;
    queryHandler = async (sql, params) => {
        if (sql.startsWith("INSERT INTO users")) {
            passwordHash = params[2];
            return { rows: [user] };
        }
        if (sql.includes("SELECT id, nick, email, password_hash")) return { rows: [{ ...user, password_hash: passwordHash }] };
        if (sql.includes("UPDATE password_resets")) return { rows: [{ user_id: 1 }] };
        if (sql.includes("UPDATE users SET password_hash")) passwordHash = params[0];
        return { rows: [] };
    };
    const ip = "192.0.2.3";
    assert.equal((await post("/auth/register", { nick: user.nick, email: user.email, password: "haslo123" }, ip)).status, 201);
    assert.ok(await bcrypt.compare("haslo123", passwordHash));
    const login = await post("/auth/login", { login: user.nick, password: "haslo123" }, ip);
    assert.equal(login.status, 200);
    assert.deepEqual((await login.json()).user, { id: 1, nick: user.nick, email: user.email });
    assert.match(login.headers.get("set-cookie"), /cgp_session=.*HttpOnly/i);
    assert.equal((await post("/auth/login", { login: user.nick, password: "wrong-password" }, ip)).status, 401);
    assert.equal((await post("/auth/reset", { token: "test-token", password: "new-password" }, ip)).status, 200);
    assert.ok(await bcrypt.compare("new-password", passwordHash));
});

test("busy password handlers reject reset before consuming its token", async () => {
    const waiting = [];
    let resets = 0;
    queryHandler = async (sql) => {
        if (sql.includes("SELECT id, nick, email, password_hash")) {
            await new Promise((resolve) => waiting.push(resolve));
        }
        if (sql.includes("UPDATE password_resets")) resets++;
        return { rows: [] };
    };
    const one = post("/auth/login", { login: "one", password: "password" }, "192.0.2.4");
    const two = post("/auth/login", { login: "two", password: "password" }, "192.0.2.5");
    try {
        for (let i = 0; waiting.length < 2 && i < 100; i++) await new Promise((resolve) => setTimeout(resolve, 10));
        assert.equal(waiting.length, 2);
        assert.equal((await post("/auth/reset", { token: "unused", password: "new-password" }, "192.0.2.6")).status, 503);
        assert.equal(resets, 0);
    } finally {
        waiting.forEach((resolve) => resolve());
        await Promise.all([one, two]);
    }
    assert.equal((await post("/auth/reset", { token: "unused", password: "new-password" }, "192.0.2.6")).status, 400);
    assert.equal(resets, 1);
});
