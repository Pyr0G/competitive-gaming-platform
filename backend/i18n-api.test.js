import assert from "node:assert/strict";
import { once } from "node:events";
import { after, mock, test } from "node:test";
import express from "express";
import { createApiRateLimit } from "./api-rate-limit.js";

let queryHandler = async () => ({ rows: [] });
mock.module(new URL("./db.js", import.meta.url).href, {
    namedExports: { query: (...args) => queryHandler(...args), transaction: (handler) => handler((...args) => queryHandler(...args)) },
});
mock.module(new URL("./config.js", import.meta.url).href, {
    namedExports: { config: { jwtSecret: "test-only-key", appUrl: "http://localhost", production: false } },
});
const sent = [];
mock.module(new URL("./mail.js", import.meta.url).href, {
    namedExports: { sendVerifyMail: async (...args) => sent.push(args), sendResetMail: async (...args) => sent.push(args) },
});
const { api } = await import("./api.js");
const { auth } = await import("./auth.js");
const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use("/limited", createApiRateLimit({ limit: 1 }));
app.get("/limited", (req, res) => res.json({ ok: true }));
app.use("/api/auth", auth);
app.use("/api", api);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
after(() => new Promise((resolve) => server.close(resolve)));
const origin = "http://127.0.0.1:" + server.address().port;
const post = (path, body, headers = {}) => fetch(origin + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

test("route validation and throttling return the requested language with stable keys", async () => {
    const en = await (await post("/api/auth/login", {})).json();
    const pl = await (await post("/api/auth/login", {}, { "x-cgp-language": "pl", "x-forwarded-for": "192.0.2.21" })).json();
    assert.equal(en.errorKey, "auth.credentialsRequired");
    assert.equal(pl.errorKey, en.errorKey);
    assert.match(en.error, /^Enter your username/);
    assert.match(pl.error, /^Podaj nazwę/);
    assert.equal((await fetch(origin + "/limited")).status, 200);
    const limited = await fetch(origin + "/limited", { headers: { "x-cgp-language": "pl" } });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error, "Przekroczono limit prób. Poczekaj przed ponowną próbą.");
});

test("tournament data keeps timestamps and missing maps independent of display language", async () => {
    queryHandler = async (sql) => {
        if (sql.includes("FROM tournaments")) return { rows: [{ id: 1, name: "Sample Cup", max_teams: 8, format: "bo1", status: "in_progress", starts_at: new Date("2026-11-14T18:00:00+01:00") }] };
        if (sql.includes("FROM tournament_teams")) return { rows: [] };
        if (sql.includes("FROM matches")) return { rows: [{ tournament_id: 1, round: 1, position: 1, a: "AAA", b: "BBB", map: null, scheduled_at: null, status: "scheduled" }] };
        return { rows: [{ tag: "AAA", name: "Alpha" }, { tag: "BBB", name: "Beta" }] };
    };
    const english = await (await fetch(origin + "/api/tournaments", { headers: { "accept-language": "en-US" } })).json();
    const polish = await (await fetch(origin + "/api/tournaments", { headers: { "accept-language": "pl-PL" } })).json();
    assert.deepEqual(english, polish);
    assert.equal(english.tournaments[0].start, "2026-11-14T17:00:00.000Z");
    assert.equal(english.tournaments[0].rounds[0][0].time, null);
    assert.equal(english.tournaments[0].rounds[0][0].map, null);
});

test("registration and recovery carry the selected language into emails and their links", async () => {
    queryHandler = async (sql) => {
        if (sql.startsWith("INSERT INTO users") || sql.startsWith("SELECT id, nick, email FROM users")) return { rows: [{ id: 7, nick: "Tester", email: "tester@example.com" }] };
        return { rows: [] };
    };
    const headers = { "x-cgp-language": "pl", "x-cgp-region": "PL", "x-forwarded-for": "192.0.2.22" };
    const registered = await post("/api/auth/register", { nick: "Tester", email: "tester@example.com", password: "haslo123" }, headers);
    assert.equal(registered.status, 201);
    assert.equal((await registered.json()).messageKey, "auth.registered");
    await post("/api/auth/forgot", { email: "tester@example.com" }, headers);
    for (const [, , link, language] of sent) {
        const url = new URL(link);
        assert.equal(language, "pl");
        assert.equal(url.searchParams.get("lang"), "pl");
        assert.equal(url.searchParams.get("region"), "PL");
    }
    assert.equal(sent.length, 2);
    const verified = await fetch(origin + "/api/auth/verify?token=invalid&lang=pl&region=PL", { redirect: "manual" });
    assert.equal(verified.headers.get("location"), "/?verified=0&lang=pl&region=PL");
});
