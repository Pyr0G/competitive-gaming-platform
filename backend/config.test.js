import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const readConfig = (mode, autoInit) => {
    const env = { ...process.env, NODE_ENV: mode, DATABASE_URL: "postgresql://test@localhost/test" };
    delete env.AUTO_INIT_DATABASE;
    if (autoInit !== undefined) env.AUTO_INIT_DATABASE = autoInit;
    return spawnSync(process.execPath, ["--input-type=module", "-e", "import { config } from './config.js'; console.log(JSON.stringify(config.autoInitDatabase));"], {
        cwd: import.meta.dirname, env, encoding: "utf8",
    });
};

test("production never enables demo initialization", () => {
    for (const flag of [undefined, "false", "", "TRUE", "1"]) {
        const result = readConfig("production", flag);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim(), "false", String(flag));
    }
    const enabled = readConfig("production", "true");
    assert.notEqual(enabled.status, 0);
    assert.match(enabled.stderr, /AUTO_INIT_DATABASE/);
});

test("local demo initialization requires explicit opt-in", () => {
    for (const flag of [undefined, "false", "", "TRUE", "1"]) {
        assert.equal(readConfig("development", flag).stdout.trim(), "false", String(flag));
    }
    assert.equal(readConfig("development", "true").stdout.trim(), "true");
});

test("Render explicitly disables database auto initialization", async () => {
    const blueprint = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
    assert.match(blueprint, /- key: AUTO_INIT_DATABASE\s+value: "false"/);
});

test("the reset command refuses production before contacting a database", () => {
    const result = spawnSync(process.execPath, ["reset-db.js"], {
        cwd: import.meta.dirname, encoding: "utf8",
        env: { ...process.env, NODE_ENV: "production", AUTO_INIT_DATABASE: "false", DATABASE_URL: "postgresql://test@127.0.0.1:1/test" },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Reset bazy jest dostępny tylko poza produkcją/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED/);
});
