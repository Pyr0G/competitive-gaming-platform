import assert from "node:assert/strict";
import { once } from "node:events";
import { mock, test } from "node:test";
import express from "express";

const config = { port: 0, production: false, jwtSecret: "test-only-key", appUrl: "http://localhost", brevoKey: "test-only-key" };
mock.module(new URL("./config.js", import.meta.url).href, { namedExports: { config } });
mock.module(new URL("./db.js", import.meta.url).href, {
    namedExports: {
        initDatabase: async () => false,
        query: async () => ({ rows: [] }),
        transaction: async (handler) => handler(async () => ({ rows: [] })),
    },
});

for (const production of [false, true]) {
    test(`${production ? "production" : "development"} startup accepts connections without a loopback-only binding`, async () => {
        config.production = production;
        let server;
        const listen = express.application.listen;
        const listener = mock.method(express.application, "listen", function (...args) {
            server = listen.apply(this, args);
            return server;
        });
        try {
            await import(`./server.js?production=${production}`);
            if (!server.listening) await once(server, "listening");
            assert.ok(["::", "0.0.0.0"].includes(server.address().address));
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { ok: true });
        } finally {
            listener.mock.restore();
            if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        }
    });
}
