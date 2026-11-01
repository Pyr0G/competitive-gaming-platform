import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const adminSource = await readFile(new URL("../frontend/admin.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../frontend/app.js", import.meta.url), "utf8");
const tickerSource = appSource.slice(appSource.indexOf("let tickerAds ="), appSource.indexOf("\nrenderRanking();", appSource.indexOf("const renderTicker =")));
const tournamentSource = appSource.slice(appSource.indexOf("const applyTournaments ="), appSource.indexOf("const notice ="));

class Element {
    hidden = false;
    innerHTML = "";
    textContent = "";
    value = "";
    listeners = new Map();
    classList = { add() {}, remove() {}, toggle() {} };

    addEventListener(type, handler) {
        this.listeners.set(type, handler);
    }

    async emit(type, event) {
        await this.listeners.get(type)?.(event);
    }
}

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

const createClient = () => {
    const elements = new Map();
    const $ = (selector) => {
        if (!elements.has(selector)) elements.set(selector, new Element());
        return elements.get(selector);
    };
    const requests = [];
    const responses = new Map([
        ["/admin/stats", { users: 1, banned: 0, ads: 0, messages: 0, reports: 0, live: 0 }],
        ["/admin/users", { users: [] }],
        ["/admin/reports", { reports: [] }],
        ["/admin/announcement", { announcement: { content: "Current announcement" } }],
        ["/admin/tournaments", { tournaments: [] }],
    ]);
    const renders = [];
    const toasts = [];
    const tournament = { id: 1, name: "Test Cup", status: "open", slots: 8, registered: [], deadline: "2099-01-01T12:00:00Z" };
    const context = vm.createContext({
        $, $$: () => [], document: Object.assign(new Element(), { body: new Element() }),
        currentUser: { id: 1, admin: true }, current: tournament, TOURNAMENTS: [tournament], TEAMS: {}, ROLES: {},
        esc: (value) => String(value ?? "").replaceAll("<", "&lt;"), placesLeft: (n) => `${n} miejsc`,
        toast: (...args) => toasts.push(args), loadAds: async () => [], loadNotice() {}, showNotice() {},
        api: async (path, body, method) => {
            requests.push({ path, body, method });
            const response = responses.get(path);
            if (response === undefined) {
                assert.ok(body !== undefined || method === "DELETE", `Unexpected read: ${path}`);
                return { ok: true };
            }
            return typeof response === "function" ? response() : response;
        },
    });
    context.selectTournament = (name) => {
        context.current = context.TOURNAMENTS.find((t) => t.name === name) || context.TOURNAMENTS[0];
    };
    context.renderCards = () => renders.push(structuredClone(context.TOURNAMENTS));
    context.renderRanking = () => {};
    const client = vm.runInContext(`${tickerSource}\n${tournamentSource}\n${adminSource}\n;({
        openAdmin, closeAdmin, runAdmin, renderTicker,
        select: (view) => { adminView = view; return drawAdmin(); }
    });`, context);
    return { ...client, $, requests, responses, renders, toasts, context };
};

test("a delayed admin view cannot replace the newly selected form", async () => {
    const c = createClient();
    const old = deferred();
    c.responses.set("/admin/users", old.promise);
    const loading = c.select("users");
    await c.select("notice");
    old.resolve({ users: [{ id: 2, nick: "Old result" }] });
    await loading;
    assert.match(c.$("#admin-main").innerHTML, /id="admin-notice"/);
    assert.doesNotMatch(c.$("#admin-main").innerHTML, /Old result/);
});

test("a failed superseded request cannot replace the current admin view", async () => {
    const c = createClient();
    const old = deferred();
    c.responses.set("/admin/users", old.promise);
    const loading = c.select("users");
    await c.select("notice");
    old.reject(new Error("Old request failed"));
    await loading;
    assert.match(c.$("#admin-main").innerHTML, /id="admin-notice"/);
    assert.doesNotMatch(c.$("#admin-main").innerHTML, /Old request failed/);
});

test("out-of-order searches keep the newest users and moderation controls", async () => {
    const c = createClient();
    const old = deferred();
    c.$("#admin-q").value = "old";
    c.responses.set("/admin/users?q=old", old.promise);
    const searching = c.select("users");
    c.$("#admin-q").value = "new";
    c.responses.set("/admin/users?q=new", { users: [{ id: 3, nick: "New result" }] });
    await c.select("users");
    old.resolve({ users: [{ id: 2, nick: "Old result" }] });
    await searching;
    assert.match(c.$("#admin-main").innerHTML, /New result/);
    assert.match(c.$("#admin-main").innerHTML, /data-id="3"/);
    assert.doesNotMatch(c.$("#admin-main").innerHTML, /Old result|data-id="2"/);
});

test("closing the panel invalidates pending content and report counts", async () => {
    const c = createClient();
    const old = deferred();
    c.responses.set("/admin/stats", old.promise);
    const opening = c.openAdmin();
    c.$("#admin-main").innerHTML = "Unchanged";
    c.$("#admin-reports").textContent = "2";
    c.closeAdmin();
    old.resolve({ reports: 99 });
    await opening;
    assert.equal(c.$("#admin").hidden, true);
    assert.equal(c.$("#admin-main").innerHTML, "Unchanged");
    assert.equal(c.$("#admin-reports").textContent, "2");
});

test("an old report list cannot replace a newer report count", async () => {
    const c = createClient();
    const old = deferred();
    c.responses.set("/admin/reports", old.promise);
    const loading = c.select("reports");
    c.responses.set("/admin/stats", { reports: 2 });
    await c.select("stats");
    old.resolve({ reports: [] });
    await loading;
    assert.equal(c.$("#admin-reports").textContent, 2);
});

test("a current request failure is still shown", async () => {
    const c = createClient();
    c.responses.set("/admin/users", () => { throw new Error("Current request failed"); });
    await c.select("users");
    assert.match(c.$("#admin-main").innerHTML, /Current request failed/);
});

test("cancellation refreshes public cards and removes the last live ticker item", async () => {
    const c = createClient();
    const live = { id: 1, name: "Live Cup", status: "live", rounds: [[{ a: "AAA", b: "BBB", state: "pending" }]] };
    c.context.TOURNAMENTS = [live];
    c.renderTicker();
    assert.match(c.$("#ticker-track").innerHTML, /<b>AAA<\/b> vs <b>BBB<\/b>/);
    c.responses.set("/tournaments", { teams: {}, tournaments: [{ ...live, status: "done" }] });
    await c.select("tournaments");
    await c.runAdmin("cancel", "1");
    assert.equal(c.renders.at(-1)[0].status, "done");
    assert.equal(c.$("#ticker-track").innerHTML, "");
    assert.ok(c.requests.some((r) => r.path === "/admin/tournaments/1/cancel"));
    assert.equal(c.requests.at(-1).path, "/admin/tournaments");
});

test("closing registration rerenders the deadline and retains ads in the ticker", async () => {
    const c = createClient();
    c.renderTicker([{ type: "lfm", team_name: "Recruiters", role: "rifler", faceit_level: 5 }]);
    const deadline = "2020-01-01T12:00:00Z";
    c.responses.set("/tournaments", { teams: {}, tournaments: [{ ...c.context.current, deadline }] });
    await c.select("tournaments");
    await c.runAdmin("close-reg", "1");
    assert.equal(c.renders.at(-1)[0].deadline, deadline);
    assert.equal(c.context.current.deadline, deadline);
    assert.match(c.$("#ticker-track").innerHTML, /Recruiters/);
    assert.ok(c.requests.some((r) => r.path === "/admin/tournaments/1/close-reg"));
});

test("a failed public refresh explains the saved change and still refreshes the admin table", async () => {
    const c = createClient();
    c.responses.set("/tournaments", () => { throw new Error("Network unavailable"); });
    await c.select("tournaments");
    await c.runAdmin("cancel", "1");
    assert.ok(c.toasts.some(([message, kind]) => kind === "err" && /Zmiana zapisana/.test(message)));
    assert.equal(c.requests.at(-1).path, "/admin/tournaments");
    assert.match(c.$("#admin-main").innerHTML, /Turnieje/);
});
