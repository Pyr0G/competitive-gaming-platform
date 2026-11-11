import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../frontend/app.js", import.meta.url), "utf8");
const userSource = source.slice(source.indexOf("const loginButton ="), source.indexOf("const toasts ="));
const noticeSource = source.slice(source.indexOf("const notice ="), source.indexOf("\nloadData();"));
const flush = () => new Promise(setImmediate);

class Element {
    hidden = false;
    dataset = {};
    textContent = "";
    offsetHeight = 48;
    listeners = new Map();
    style = { setProperty() {} };
    classList = { add() {}, remove() {}, toggle() {} };

    addEventListener(type, handler) {
        const handlers = this.listeners.get(type) || [];
        handlers.push(handler);
        this.listeners.set(type, handlers);
    }

    dispatchEvent(event) {
        for (const handler of this.listeners.get(event.type) || []) handler(event);
    }
}

const createClient = (search = "") => {
    const elements = new Map();
    const $ = (selector) => {
        if (!elements.has(selector)) elements.set(selector, new Element());
        return elements.get(selector);
    };
    const document = Object.assign(new Element(), { body: new Element(), documentElement: new Element() });
    const storage = new Map();
    const timers = [];
    const signals = [];
    let releaseTournaments;
    const tournaments = new Promise((resolve) => { releaseTournaments = resolve; });
    const state = { user: null, announcement: { id: 7, content: "Ogłoszenie testowe" } };
    const context = vm.createContext({
        $, document, window: new Element(), modal: new Element(), currentUser: null,
        CustomEvent: class { constructor(type) { this.type = type; } },
        localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => { storage.set(key, String(value)); signals.push(key); },
        },
        setTimeout: (handler) => timers.push(handler), URLSearchParams,
        location: { search, pathname: "/", hash: "" }, history: { replaceState() {} },
        backend: Promise.resolve(true), loadAds: async () => [],
        applyTournaments() {}, renderTicker() {}, openModal() {}, formMessage() {},
        api: async (path) => {
            if (path === "/tournaments") return tournaments;
            if (path === "/auth/me") return { user: state.user };
            if (path === "/announcement") return { announcement: state.announcement };
            throw new Error(`Unexpected request: ${path}`);
        },
    });
    const client = vm.runInContext(`${userSource}\n${noticeSource}\n;({ setUser, showNotice, loadData });`, context);
    return { ...client, $, context, state, storage, signals, timers, releaseTournaments };
};

test("guests see the notice even when it was dismissed by a signed-in user", () => {
    const c = createClient();
    c.storage.set("cgp-notice", "7");
    c.showNotice(c.state.announcement);
    assert.equal(c.$("#notice").hidden, false);
    assert.equal(c.$("#notice-x").hidden, true);
    c.$("#notice-x").dispatchEvent({ type: "click" });
    assert.deepEqual(c.timers, []);
    assert.equal(c.$("#notice").hidden, false);
});

test("signed-in users can dismiss the notice and logout restores it", () => {
    const c = createClient();
    c.showNotice(c.state.announcement);
    c.setUser({ id: 1, nick: "Test" });
    assert.equal(c.$("#notice-x").hidden, false);
    c.$("#notice-x").dispatchEvent({ type: "click" });
    c.timers.shift()();
    assert.equal(c.$("#notice").hidden, true);
    c.setUser(null);
    assert.equal(c.$("#notice").hidden, false);
    assert.equal(c.$("#notice-x").hidden, true);
    assert.equal(c.$("#notice-text").textContent, c.state.announcement.content);
});

test("logout during dismissal still leaves the guest notice visible", () => {
    const c = createClient();
    c.showNotice(c.state.announcement);
    c.setUser({ id: 1 });
    c.$("#notice-x").dispatchEvent({ type: "click" });
    c.setUser(null);
    c.timers.shift()();
    assert.equal(c.$("#notice").hidden, false);
    assert.equal(c.$("#notice-x").hidden, true);
});

test("a new or removed announcement replaces the retained notice", () => {
    const c = createClient();
    c.setUser({ id: 1 });
    c.storage.set("cgp-notice", "7");
    c.showNotice(c.state.announcement);
    assert.equal(c.$("#notice").hidden, true);
    c.showNotice({ id: 8, content: "Nowe ogłoszenie" });
    assert.equal(c.$("#notice").hidden, false);
    assert.equal(c.$("#notice-text").textContent, "Nowe ogłoszenie");
    c.showNotice(null);
    c.setUser(null);
    assert.equal(c.$("#notice").hidden, true);
});

test("initial guest data cannot replace a newer login while tournaments are delayed", async () => {
    const c = createClient();
    const loading = c.loadData();
    await flush();
    c.setUser({ id: 2, nick: "New login" }, true);
    c.releaseTournaments([]);
    await loading;
    assert.equal(c.context.currentUser.id, 2);
    assert.equal(c.$(".btn-login").dataset.modal, "account");
});

test("activation broadcasts the new session to other tabs", async () => {
    const c = createClient("?verified=1");
    c.state.user = { id: 3, nick: "Verified" };
    c.releaseTournaments([]);
    await c.loadData();
    assert.equal(c.context.currentUser.id, 3);
    assert.ok(c.signals.includes("cgp-auth-change"));
});
