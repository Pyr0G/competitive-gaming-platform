import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../frontend/app.js", import.meta.url), "utf8");
const faceitSource = source.slice(source.indexOf("const faceitForm ="), source.indexOf("const modal ="));
const id = "1-4c7e9b12-3a5d-4f6e-8b21-9d0c3e7a5f18";

class Element {
    children = [];
    textContent = "";
    listeners = new Map();
    classList = { add() {}, remove() {} };
    constructor(tag = "div") { this.tag = tag; }
    set innerHTML(value) {
        assert.ok(this.tag !== "li" && this.tag !== "code", "progress text must never be parsed as HTML");
        this.html = value;
        this.children = [];
    }
    append(child) { this.children.push(child); }
    addEventListener(type, handler) { this.listeners.set(type, handler); }
}

const client = () => {
    const elements = new Map();
    const $ = (selector) => {
        if (!elements.has(selector)) elements.set(selector, new Element());
        return elements.get(selector);
    };
    const tournament = { id: 1, rounds: [[{ a: "a", b: "b", state: "pending" }]] };
    vm.runInNewContext(faceitSource, {
        $, document: { createElement: (tag) => new Element(tag) },
        bPanel: new Element(), bracket: new Element(),
        TOURNAMENTS: [tournament], TEAMS: { a: "Pierogi", b: "Smoki" }, current: tournament,
        reducedMotion: true, setTimeout: (handler) => handler(),
        renderBracket() {}, renderPanel() {}, renderInfo() {}, renderRanking() {},
        winnerOf: () => "b",
    });
    return { $, tournament, submit: () => $("#faceit-form").listeners.get("submit")({ preventDefault() {} }) };
};

test("FACEIT demo renders the ID as a code node and still completes the result", async () => {
    const c = client();
    c.$("#faceit-link").value = `https://www.faceit.com/pl/cs2/room/${id.toUpperCase()}/<img src=x onerror=alert(1)>`;
    await c.submit();
    const steps = c.$("#faceit-steps").children;
    assert.equal(steps.length, 5);
    assert.equal(steps[0].textContent, "Link poprawny, ID meczu: ");
    assert.equal(steps[0].children.length, 1);
    assert.equal(steps[0].children[0].tag, "code");
    assert.equal(steps[0].children[0].textContent, id);
    assert.equal(c.tournament.rounds[0][0].faceit, id);
    assert.equal(c.tournament.rounds[0][0].state, "done");
    assert.equal(c.$("button[type=submit]").disabled, false);
    assert.match(c.$("#faceit-msg").html, /Smoki.*13:10/);
});

test("FACEIT rejects markup in the match ID without changing the bracket", async () => {
    const c = client();
    c.$("#faceit-link").value = "https://faceit.com/pl/cs2/room/<img src=x onerror=alert(1)>";
    await c.submit();
    assert.equal(c.$("#faceit-steps").children.length, 0);
    assert.equal(c.tournament.rounds[0][0].state, "pending");
    assert.match(c.$("#faceit-msg").html, /To nie wygląda/);
});
