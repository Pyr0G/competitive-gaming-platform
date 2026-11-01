import assert from "node:assert/strict";
import { test } from "node:test";
import { createTypingStore } from "./typing-state.js";

test("typing expires at 2.5 seconds and renewed markers keep their new expiry", () => {
    let time = 0;
    const typing = createTypingStore({ now: () => time });
    assert.equal(typing.set("1:1"), true);
    time = 2499;
    assert.equal(typing.has("1:1"), true);
    assert.equal(typing.set("1:1"), true);
    time = 4998;
    assert.equal(typing.has("1:1"), true);
    time = 4999;
    assert.equal(typing.has("1:1"), false);
});

test("typing identity churn cannot evict live markers or exceed capacity", () => {
    let time = 0;
    const typing = createTypingStore({ maxEntries: 2, now: () => time });
    assert.equal(typing.set("1:1"), true);
    assert.equal(typing.set("2:2"), true);
    for (let i = 3; i < 100; i++) assert.equal(typing.set(`${i}:1`), false);
    assert.equal(typing.has("1:1"), true);
    time = 1000;
    assert.equal(typing.set("1:1"), true);
    time = 2500;
    assert.equal(typing.set("3:3"), true);
    assert.equal(typing.has("2:2"), false);
    assert.equal(typing.has("1:1"), true);
    typing.delete("1:1");
    assert.equal(typing.set("4:4"), true);
    assert.equal(typing.has("1:1"), false);
});
