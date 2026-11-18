import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter, createWorkLimiter } from "./resource-limits.js";

const response = () => ({
    statusCode: 200,
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
});

const request = (middleware, ip, path = "/login") => {
    const res = response();
    middleware({ ip, path }, res, () => { res.allowed = true; });
    return res;
};

test("equivalent spellings and separately constructed middleware share an operation quota", () => {
    const limit = createRateLimiter();
    const first = limit("login", 2, 15);
    const second = limit("login", 2, 15);
    assert.ok(request(first, "client", "/login").allowed);
    assert.ok(request(second, "client", "/LOGIN/").allowed);
    assert.equal(request(first, "client", "/LoGiN").statusCode, 429);
    assert.ok(request(limit("register", 2, 15), "client").allowed);
    assert.ok(request(first, "another-client").allowed);
});

test("capacity rejects identity churn without resetting an existing allowance", () => {
    const limit = createRateLimiter({ maxEntries: 2 });
    const login = limit("login", 1, 15);
    assert.ok(request(login, "a").allowed);
    assert.ok(request(login, "b").allowed);
    for (let i = 0; i < 50; i++) assert.equal(request(login, `extra-${i}`).statusCode, 503);
    assert.equal(request(login, "a").statusCode, 429);
});

test("expired identities free capacity and an allowance resets exactly at expiry", () => {
    let time = 0;
    const limit = createRateLimiter({ maxEntries: 1, now: () => time });
    const login = limit("login", 1, 1);
    assert.ok(request(login, "a").allowed);
    time = 59999;
    assert.equal(request(login, "a").statusCode, 429);
    time = 60000;
    assert.ok(request(login, "b").allowed);
    time = 120000;
    assert.ok(request(login, "b").allowed);
});

test("password operations share a cap and reject work before it starts", async () => {
    const gate = createWorkLimiter(2);
    let release;
    let started = 0;
    const waiting = new Promise((resolve) => { release = resolve; });
    const register = gate(async () => { started++; await waiting; });
    const login = gate(async () => { started++; await waiting; });
    const reset = gate(async () => { started++; });
    const first = register({}, response());
    const second = login({}, response());
    const busy = response();
    await reset({}, busy);
    assert.equal(busy.statusCode, 503);
    assert.equal(started, 2);
    assert.equal(busy.headers["Retry-After"], "1");
    release();
    await Promise.all([first, second]);
    await reset({}, response());
    assert.equal(started, 3);
});

test("completed responses and disconnects do not release unfinished work", async () => {
    const gate = createWorkLimiter(1);
    let release;
    const pending = gate(async (req, res) => {
        res.json({ ok: true });
        await new Promise((resolve) => { release = resolve; });
    })({ destroyed: true }, response());
    const busy = response();
    await gate(async () => assert.fail("unfinished work must retain its slot"))({}, busy);
    assert.equal(busy.statusCode, 503);
    release();
    await pending;
});

test("a rejected handler releases its slot and still propagates the error", async () => {
    const gate = createWorkLimiter(1);
    await assert.rejects(gate(async () => { throw new Error("failure"); })({}, response()), /failure/);
    let ran = false;
    await gate(async () => { ran = true; })({}, response());
    assert.ok(ran);
});
