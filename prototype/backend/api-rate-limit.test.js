import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { mock, test } from "node:test";
import express from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { createApiRateLimit } from "./api-rate-limit.js";

const config = { jwtSecret: "test-only-session-key" };
let lookups = 0;
mock.module(new URL("./config.js", import.meta.url).href, { namedExports: { config } });
mock.module(new URL("./db.js", import.meta.url).href, { namedExports: {
    query: async () => { lookups++; return { rows: [{ password_hash: "test-only-hash" }] }; },
    transaction: async () => { throw new Error("Unexpected transaction"); },
} });
mock.module(new URL("./mail.js", import.meta.url).href, { namedExports: { sendVerifyMail: async () => {}, sendResetMail: async () => {} } });
const { readSession } = await import("./auth.js");
const cookie = `cgp_session=${jwt.sign({ id: 1, auth: crypto.createHmac("sha256", config.jwtSecret).update("cgp-session:test-only-hash").digest("hex") }, config.jwtSecret)}`;

const start = async (t, options) => {
    const app = express();
    app.set("trust proxy", 1);
    app.use("/api", createApiRateLimit(options));
    app.use(express.json({ limit: "20kb" }));
    app.use("/api", readSession);
    app.use("/api", (req, res) => res.json({ userId: req.userId }));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => new Promise((resolve) => server.close(resolve)));
    return (path = "/api/auth/me", ip = "192.0.2.30", session = cookie) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        headers: { "x-forwarded-for": ip, cookie: session },
    });
};

test("API floods stop before session verification and database lookups across routes", async (t) => {
    const request = await start(t);
    lookups = 0;
    for (let i = 0; i < 300; i++) {
        const response = await request(i % 2 ? "/API/CHAT/unread/" : "/api/auth/me");
        assert.equal(response.status, 200);
        assert.equal((await response.json()).userId, 1);
    }
    assert.equal(lookups, 300);
    const verify = mock.method(jwt, "verify");
    const blocked = await request("/api/ads");
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.equal(verify.mock.callCount(), 0);
    assert.equal(lookups, 300);
    assert.equal((await request("/api/chat", "192.0.2.31")).status, 200);
    assert.equal(lookups, 301);
    verify.mock.restore();
    const serverSource = await readFile(new URL("./server.js", import.meta.url), "utf8");
    assert.ok(serverSource.indexOf('app.use("/api", apiRateLimit)') < serverSource.indexOf('app.use("/api", readSession)'));
});

test("API capacity rejects identity churn, preserves quotas and recovers after expiry", async (t) => {
    let time = Date.now();
    const request = await start(t, { maxEntries: 2, limit: 2, now: () => time });
    assert.equal((await request("/api/ads", "192.0.2.40", "")).status, 200);
    assert.equal((await request("/api/ads", "192.0.2.40", "invalid")).status, 200);
    assert.equal((await request("/api/chat", "192.0.2.40", "")).status, 429);
    assert.equal((await request("/api/ads", "192.0.2.41")).status, 200);
    for (let i = 42; i < 52; i++) assert.equal((await request("/api/ads", `192.0.2.${i}`)).status, 429);
    assert.equal((await request("/api/ads", "192.0.2.40")).status, 429);
    time += 59999;
    assert.equal((await request("/api/ads", "192.0.2.40")).status, 429);
    time++;
    assert.equal((await request("/api/ads", "192.0.2.42")).status, 200);
    assert.equal((await request("/api/ads", "192.0.2.40")).status, 200);
});

test("IPv6 address rotation within a subnet shares the API allowance", async (t) => {
    const request = await start(t, { limit: 2 });
    assert.equal((await request("/api/chat", "2001:db8:abcd:1200::1")).status, 200);
    assert.equal((await request("/api/ads", "2001:db8:abcd:12ff::2")).status, 200);
    assert.equal((await request("/api/auth/me", "2001:db8:abcd:1201::3")).status, 429);
    assert.equal((await request("/api/auth/me", "2001:db8:abcd:1300::1")).status, 200);
});
