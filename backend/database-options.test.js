import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { checkServerIdentity } from "node:tls";
import { createSecureContext, TLSSocket } from "node:tls";
import { createServer } from "node:net";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { databaseOptions } from "./database-options.js";

const effective = (url) => new pg.Client(databaseOptions(url)).connectionParameters;

test("remote databases verify certificates and hostnames at the final pg consumer", () => {
    for (const suffix of ["", "?sslmode=require", "?sslmode=verify-full", "?ssl=true", "?ssl=1", "?uselibpqcompat=false"]) {
        const options = databaseOptions(`postgresql://bartek:test-only@database.example/platforma${suffix}`);
        assert.equal(options.connectionString, undefined);
        const client = new pg.Client(options).connectionParameters;
        assert.equal(client.host, "database.example");
        assert.equal(client.ssl.rejectUnauthorized, true);
        assert.equal(client.ssl.checkServerIdentity, checkServerIdentity);
    }
});

test("local development and the explicit R740 private database retain plaintext support", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
        assert.equal(effective(`postgresql://bartek:test-only@${host}/platforma`).ssl, false);
        assert.equal(effective(`postgresql://bartek:test-only@${host}/platforma?sslmode=disable`).ssl, false);
        assert.equal(effective(`postgresql://bartek:test-only@${host}/platforma?sslmode=verify-full`).ssl.rejectUnauthorized, true);
    }
    assert.equal(effective("postgresql://cgp_app:test-only@db:5432/platforma?sslmode=disable").ssl, false);
    assert.equal(effective("postgresql://cgp_app:test-only@db:5432/platforma").ssl.rejectUnauthorized, true);
});

test("TLS policy follows the effective host rather than credential or hostname substrings", () => {
    for (const url of [
        "postgresql://localhost:test-only@database.example/platforma",
        "postgresql://bartek:test-only@database.example/localhost",
        "postgresql://bartek:test-only@localhost.attacker.example/platforma",
        "postgresql://bartek:test-only@127.0.0.1.attacker.example/platforma",
        "postgresql://bartek:test-only@localhost/platforma?host=database.example",
    ]) assert.equal(effective(url).ssl.rejectUnauthorized, true, url);
    assert.equal(effective("postgresql://bartek:test-only@database.example/platforma?host=localhost").ssl, false);
});

test("unsafe, ambiguous and alternate TLS settings fail closed", () => {
    for (const suffix of [
        "sslmode=disable", "ssl=0", "ssl=false", "ssl=no-verify", "sslmode=no-verify",
        "sslmode=prefer", "sslmode=verify-ca", "uselibpqcompat=true&sslmode=require",
        "sslmode=disable&sslmode=verify-full", "sslmode=verify-full&sslmode=disable",
        "SSL=0", "ssl=true&sslmode=disable", "sslmode=unknown", "sslmode=",
        "connectionString=postgresql%3A%2F%2Flocalhost%2Ftest",
    ]) assert.throws(() => effective(`postgresql://bartek:test-only@database.example/platforma?${suffix}`), suffix);
    assert.throws(() => effective("postgresql://bartek:test-only@localhost/platforma?host=database.example&sslmode=disable"));
    assert.throws(() => databaseOptions("invalid address"), /DATABASE_URL/);
});

test("remote TLS authenticates the expected hostname", () => {
    const ssl = effective("postgresql://bartek:test-only@database.example/platforma").ssl;
    const certificate = { subjectaltname: "DNS:database.example", subject: { CN: "database.example" } };
    assert.equal(ssl.checkServerIdentity("database.example", certificate), undefined);
    assert.equal(ssl.checkServerIdentity("attacker.example", certificate).code, "ERR_TLS_CERT_ALTNAME_INVALID");
});

test("client certificates retain their private key through the final pg consumer", async () => {
    const certificate = encodeURIComponent(fileURLToPath(new URL("./test-fixtures/postgres-test.crt", import.meta.url)));
    const keyPath = fileURLToPath(new URL("./test-fixtures/postgres-test.key", import.meta.url));
    const options = databaseOptions(`postgresql://bartek:test-only@database.example/platforma?sslmode=verify-full&sslcert=${certificate}&sslkey=${encodeURIComponent(keyPath)}&sslrootcert=${certificate}`);
    const client = new pg.Client(options).connectionParameters;
    assert.ok(client.ssl.key === await readFile(keyPath, "utf8"), "the client private key is preserved");
    assert.equal(Object.keys(client.ssl).includes("key"), false);
    assert.equal(client.ssl.rejectUnauthorized, true);
});

test("pg rejects an untrusted certificate and accepts the explicit test CA", async (t) => {
    const cert = await readFile(new URL("./test-fixtures/postgres-test.crt", import.meta.url));
    const key = await readFile(new URL("./test-fixtures/postgres-test.key", import.meta.url));
    const secureContext = createSecureContext({ cert, key, ca: cert });
    const sockets = new Set();
    let startupPackets = 0;
    let clientCertificates = 0;
    const server = createServer((socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
        socket.on("error", () => {});
        socket.once("data", (packet) => {
            assert.equal(packet.readInt32BE(4), 80877103);
            socket.write("S");
            const secure = new TLSSocket(socket, { isServer: true, secureContext, requestCert: true, rejectUnauthorized: false });
            sockets.add(secure);
            secure.on("close", () => sockets.delete(secure));
            secure.on("error", () => {});
            secure.once("data", () => {
                startupPackets++;
                if (secure.getPeerCertificate().raw) clientCertificates++;
                const body = Buffer.from("SFATAL\0C28000\0Mtest TLS established\0\0");
                const reply = Buffer.alloc(body.length + 5);
                reply[0] = 69;
                reply.writeInt32BE(body.length + 4, 1);
                body.copy(reply, 5);
                secure.end(reply);
            });
        });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(async () => {
        for (const socket of sockets) socket.destroy();
        await new Promise((resolve) => server.close(resolve));
    });
    const base = `postgresql://bartek:test-only@127.0.0.1:${server.address().port}/platforma?sslmode=verify-full`;
    const untrusted = new pg.Client({ ...databaseOptions(base), connectionTimeoutMillis: 2000 });
    try {
        await assert.rejects(untrusted.connect(), (err) => err.code === "DEPTH_ZERO_SELF_SIGNED_CERT");
    } finally {
        await untrusted.end();
    }
    assert.equal(startupPackets, 0);
    const ca = encodeURIComponent(fileURLToPath(new URL("./test-fixtures/postgres-test.crt", import.meta.url)));
    const trusted = new pg.Client({ ...databaseOptions(`${base}&sslrootcert=${ca}`), connectionTimeoutMillis: 2000 });
    try {
        await assert.rejects(trusted.connect(), /test TLS established/);
    } finally {
        await trusted.end();
    }
    assert.equal(startupPackets, 1);
    const keyPath = encodeURIComponent(fileURLToPath(new URL("./test-fixtures/postgres-test.key", import.meta.url)));
    const mutual = new pg.Client({ ...databaseOptions(`${base}&sslrootcert=${ca}&sslcert=${ca}&sslkey=${keyPath}`), connectionTimeoutMillis: 2000 });
    try {
        await assert.rejects(mutual.connect(), /test TLS established/);
    } finally {
        await mutual.end();
    }
    assert.equal(startupPackets, 2);
    assert.equal(clientCertificates, 1);
});
