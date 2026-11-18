import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

test("server and browser email validation preserve ordinary addresses and reject hostile forms", async () => {
    const cases = [
        ["bartek@example.com", true], ["player+cs2@sub.example.com", true],
        ["gracz@przykład.pl", true], ["a@a..", true], ["a@.b.c", true],
        ["a".repeat(242) + "@example.com", true],
        ["", false], ["@example.com", false], ["a@b", false], ["a@.b", false],
        ["a@b.", false], ["a@@b.co", false], ["a b@example.com", false],
        ["a@b.\nc", false], ["a\u00a0@example.com", false],
        ["a".repeat(243) + "@example.com", false],
        ["!@!." + "!.".repeat(8000), false], ["a@" + ".".repeat(16000), false],
    ];
    for (const file of ["./auth.js", "../frontend/app.js"]) {
        const source = await readFile(new URL(file, import.meta.url), "utf8");
        const start = source.indexOf("const validEmail =");
        const end = source.indexOf("\n};", start) + 3;
        const valid = vm.runInNewContext(`${source.slice(start, end)}; validEmail;`);
        for (const [email, expected] of cases) assert.equal(valid(email), expected, `${file}: ${email.slice(0, 40)}`);
    }
});
