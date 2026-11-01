import assert from "node:assert/strict";
import { once } from "node:events";
import { after, mock, test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { createTypingStore } from "./typing-state.js";

const config = { jwtSecret: "test-only-session-key", appUrl: "http://localhost", production: false };
let time = 0;
let lookups = 0;
const conversations = new Map([
    [1, [1, 2]], [2, [1, 2]], [3, [1, 2]], [4, [1, 3]],
]);
const messages = [];
mock.module(new URL("./config.js", import.meta.url).href, { namedExports: { config } });
mock.module(new URL("./typing-state.js", import.meta.url).href, {
    namedExports: { createTypingStore: () => createTypingStore({ maxEntries: 2, now: () => time }) },
});
mock.module(new URL("./db.js", import.meta.url).href, {
    namedExports: {
        transaction: async () => { throw new Error("Unexpected transaction"); },
        query: async (sql, params) => {
            if (sql.startsWith("SELECT password_hash")) return { rows: [{ password_hash: "test-only-hash" }] };
            if (sql.startsWith("SELECT is_admin, banned_at")) {
                return { rows: [{ is_admin: false, banned_at: params[0] === 4 ? new Date() : null }] };
            }
            if (sql.includes("WHERE c.id = $1")) {
                lookups++;
                const users = conversations.get(params[0]);
                return { rows: users?.includes(params[1]) ? [{ id: params[0], user_a_id: users[0], user_b_id: users[1], nick: "peer" }] : [] };
            }
            if (sql.includes("INSERT INTO messages")) {
                const message = { id: messages.length + 1, sender_id: params[1], content: params[2], mine: true };
                messages.push(message);
                return { rows: [message] };
            }
            if (sql.includes("AS blocked,")) return { rows: [{ blocked: false, blocked_by: false }] };
            return { rows: [] };
        },
    },
});
mock.module(new URL("./mail.js", import.meta.url).href, {
    namedExports: { sendVerifyMail: async () => {}, sendResetMail: async () => {} },
});
const { readSession } = await import("./auth.js");
const { chat } = await import("./chat.js");
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(readSession);
app.use("/api/chat", chat);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
after(() => new Promise((resolve) => server.close(resolve)));
const origin = `http://127.0.0.1:${server.address().port}`;

const request = (path, { user = 1, ip = "192.0.2.10", body } = {}) => fetch(`${origin}/api/chat${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
        cookie: user ? `cgp_session=${jwt.sign({ id: user, auth: crypto.createHmac("sha256", config.jwtSecret).update("cgp-session:test-only-hash").digest("hex") }, config.jwtSecret)}` : "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
});
const isTyping = async (id, user = 2) => {
    const res = await request(`/${id}`, { user });
    assert.equal(res.status, 200);
    return (await res.json()).conversation.typing;
};

test("typing rejects unauthenticated, banned, invalid and unrelated conversations before allocating state", async () => {
    assert.equal((await request("/1/typing", { user: 0, body: {} })).status, 401);
    assert.equal((await request("/1/typing", { user: 4, body: {} })).status, 403);
    const before = lookups;
    for (const id of ["0", "-1", "1.5", "Infinity", "NaN", "9007199254740992"]) {
        assert.equal((await request(`/${id}/typing`, { body: {} })).status, 400, id);
    }
    assert.equal(lookups, before);
    assert.equal((await request("/1/typing", { user: 3, body: {} })).status, 404);
    assert.equal((await request("/999/typing", { body: {} })).status, 404);
    assert.equal(await isTyping(1), false);
    assert.equal((await request("/1/typing", { body: {} })).status, 200);
    assert.equal((await request("/2/typing", { body: {} })).status, 200);
});

test("typing is visible to the peer, refreshes at capacity, expires and clears after a valid message", async () => {
    time = 3000;
    assert.equal((await request("/1/typing", { body: {} })).status, 200);
    assert.equal(await isTyping(1), true);
    assert.equal(await isTyping(1, 1), false);
    assert.equal(await isTyping(4, 3), false);
    assert.equal((await request("/2/typing", { body: {} })).status, 200);
    const full = await request("/3/typing", { body: {} });
    assert.equal(full.status, 503);
    assert.equal(full.headers.get("retry-after"), "3");
    time = 4000;
    assert.equal((await request("/1/typing", { body: {} })).status, 200);
    time = 5500;
    assert.equal(await isTyping(2), false);
    assert.equal(await isTyping(1), true);
    assert.equal((await request("/3/typing", { body: {} })).status, 200);
    const sent = await request("/1", { body: { content: "Cześć!" } });
    assert.equal(sent.status, 201);
    assert.equal((await sent.json()).message.content, "Cześć!");
    assert.equal(await isTyping(1), false);
    assert.equal((await request("/1/typing", { body: {} })).status, 200);
    time = 8000;
    assert.equal(await isTyping(1), false);
    assert.equal(await isTyping(3), false);
});

test("chat quotas share route aliases and conversation IDs while operations and clients stay independent", async () => {
    const ip = "192.0.2.20";
    const routes = [
        [20, (i) => i % 2 ? "/OPEN/" : "/open"],
        [40, (i) => i % 2 ? `/${1000 + i}/` : `/${1000 + i}`],
        [8, (i) => i % 2 ? `/${1000 + i}/REPORT/` : `/${1000 + i}/report`],
    ];
    for (const [max, path] of routes) {
        for (let i = 0; i < max; i++) {
            assert.equal((await request(path(i), { ip, body: {} })).status, 400);
        }
        const blocked = await request(path(max), { ip, body: {} });
        assert.equal(blocked.status, 429);
        assert.ok(Number(blocked.headers.get("retry-after")) > 0);
        assert.equal((await request(path(max), { ip: "192.0.2.21", body: {} })).status, 400);
    }
});

test("typing quotas apply across aliases and arbitrary conversation IDs before lookups", async () => {
    const ip = "192.0.2.30";
    for (let i = 0; i < 120; i++) {
        const path = i % 2 ? `/${1000 + i}/TYPING/` : `/${1000 + i}/typing`;
        assert.equal((await request(path, { ip, body: {} })).status, 404);
    }
    const before = lookups;
    assert.equal((await request("/1/typing", { ip, body: {} })).status, 429);
    assert.equal(lookups, before);
    assert.equal((await request("/1/typing", { ip: "192.0.2.31", body: {} })).status, 200);
});
