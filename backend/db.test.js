import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import pg from "pg";

const config = {
    databaseUrl: "postgresql://cgp_app:test-only@db:5432/platforma?sslmode=disable",
    autoInitDatabase: false,
};
mock.module(new URL("./config.js", import.meta.url).href, { namedExports: { config } });
const { pool, initDatabase } = await import("./db.js");
after(() => pool.end());

test("the production URL disables TLS only for the explicitly configured private connection", () => {
    const client = new pg.Client(pool.options);
    assert.equal(client.connectionParameters.host, "db");
    assert.equal(client.connectionParameters.user, "cgp_app");
    assert.equal(client.connectionParameters.ssl, false);
});

test("production startup checks existing tables without attempting schema creation", async () => {
    const calls = [];
    const query = mock.method(pool, "query", async (sql) => {
        calls.push(sql);
        return { rows: [{ users: "users" }] };
    });
    try {
        assert.equal(await initDatabase(), false);
        assert.equal(calls.length, 1);
        assert.match(calls[0], /SELECT to_regclass/);
    } finally {
        query.mock.restore();
    }
});

test("production refuses missing tables instead of seeding or requiring owner privileges", async () => {
    const calls = [];
    const query = mock.method(pool, "query", async (sql) => {
        calls.push(sql);
        return { rows: [{ users: null }] };
    });
    try {
        await assert.rejects(initDatabase(), /Brak tabel/);
        assert.equal(calls.length, 1);
    } finally {
        query.mock.restore();
    }
});

test("local demo initialization still loads schema and seed when enabled", async () => {
    const calls = [];
    config.autoInitDatabase = true;
    const query = mock.method(pool, "query", async (sql) => {
        calls.push(sql);
        return { rows: [{ users: null }] };
    });
    try {
        assert.equal(await initDatabase(), true);
        assert.equal(calls.length, 3);
        assert.match(calls[1], /CREATE TABLE users/);
        assert.match(calls[2], /INSERT INTO users/);
    } finally {
        config.autoInitDatabase = false;
        query.mock.restore();
    }
});
