import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../frontend/chat.js", import.meta.url), "utf8");
const flush = () => new Promise(setImmediate);
const message = (id, content = `message ${id}`, mine = false) => ({ id, content, mine, sent_at: "2026-11-01T12:00:00Z" });
const thread = (id, messages = []) => ({
    conversation: { id, nick: `Player ${id}`, blocked: false, blocked_by: false, typing: false },
    messages,
});

class Element {
    hidden = false;
    innerHTML = "";
    textContent = "";
    value = "";
    style = {};
    scrollHeight = 100;
    scrollTop = 0;
    clientHeight = 100;
    listeners = new Map();

    addEventListener(type, handler) {
        const handlers = this.listeners.get(type) || [];
        handlers.push(handler);
        this.listeners.set(type, handlers);
    }

    async emit(type) {
        for (const handler of this.listeners.get(type) || []) await handler({ preventDefault() {} });
    }

    setAttribute() {}

    querySelector(selector) {
        const id = selector.match(/^\[data-id="(\d+)"\]$/)?.[1];
        return id && this.innerHTML.includes(`data-id="${id}"`) ? {} : null;
    }

    insertAdjacentHTML(position, html) {
        assert.equal(position, "beforeend");
        this.innerHTML += html;
    }
}

const createClient = async () => {
    const elements = new Map();
    const $ = (selector) => {
        if (!elements.has(selector)) elements.set(selector, new Element());
        return elements.get(selector);
    };
    $("#chat").hidden = true;
    $("#chat-report").hidden = true;
    const document = new Element();
    document.body = { classList: { add() {}, remove() {} } };
    const state = { unread: 0, conversations: [], threads: new Map() };
    const requests = [];
    const pauses = [];
    const toasts = [];
    let tick;
    const context = vm.createContext({
        $, $$: () => [], document, currentUser: { id: 1 }, backend: Promise.resolve(true),
        esc: (value) => String(value).replaceAll("<", "&lt;"),
        toast: (...args) => toasts.push(args), openModal() {},
        setInterval: (handler) => { tick = handler; return 1; },
        api: (path, body) => {
            requests.push({ path, body });
            let data;
            if (path === "/chat/unread") data = { unread: state.unread };
            else if (path === "/chat") data = { conversations: state.conversations };
            else {
                const match = path.match(/^\/chat\/(\d+)(?:\?after=(\d+))?$/);
                assert.ok(match, `Unexpected request: ${path}`);
                const current = state.threads.get(Number(match[1]));
                assert.ok(current, `Missing thread: ${path}`);
                if (body) {
                    const id = Math.max(0, ...current.messages.map((m) => m.id)) + 1;
                    const saved = message(id, body.content, true);
                    current.messages.push(saved);
                    data = { message: saved };
                } else {
                    data = { conversation: current.conversation, messages: current.messages.filter((m) => m.id > Number(match[2] || 0)) };
                }
            }
            const snapshot = structuredClone(data);
            const pause = pauses.find((p) => !p.started && p.matches(path, body));
            if (!pause) return Promise.resolve(snapshot);
            pause.started = true;
            return new Promise((resolve, reject) => {
                pause.release = () => resolve(snapshot);
                pause.reject = reject;
            });
        },
    });
    const client = vm.runInContext(`${source}\n;({ openChat, openThread, closeChat, showList, pollChat, refreshUnread });`, context);
    await flush();
    return {
        ...client, $, state, requests, context, document, toasts,
        tick: () => tick(),
        pause: (matches) => {
            const pause = { matches, started: false };
            pauses.push(pause);
            return pause;
        },
        ids: () => [...$("#chat-msgs").innerHTML.matchAll(/data-id="(\d+)"/g)].map((m) => Number(m[1])),
        send: (content) => {
            $("textarea").value = content;
            return $("#chat-form").emit("submit");
        },
    };
};

test("sending fetches intervening incoming messages before advancing the receive cursor", async () => {
    const c = await createClient();
    c.state.threads.set(1, thread(1, [message(10)]));
    await c.openChat();
    await c.openThread(1);
    c.state.threads.get(1).messages.push(message(11, "incoming before send"));
    await c.send("outgoing");
    await c.tick();
    assert.deepEqual(c.ids(), [10, 11, 12]);
    assert.ok(c.requests.some((r) => r.body === undefined && r.path === "/chat/1?after=10"));
    assert.equal(c.requests.filter((r) => r.path.startsWith("/chat/1?")).at(-1).path, "/chat/1?after=12");
});

test("an old conversation poll cannot change the selected conversation or its receive cursor", async () => {
    const c = await createClient();
    c.state.threads.set(1, thread(1, [message(100)]));
    c.state.threads.set(2, thread(2, [message(20)]));
    await c.openChat();
    await c.openThread(1);
    c.state.threads.get(1).messages.push(message(101));
    const delayed = c.pause((path) => path === "/chat/1?after=100");
    const polling = c.tick();
    await flush();
    assert.ok(delayed.started);
    await c.openThread(2);
    delayed.release();
    await polling;
    c.state.threads.get(2).messages.push(message(21));
    await c.tick();
    assert.equal(c.$("#chat-name").textContent, "Player 2");
    assert.deepEqual(c.ids(), [20, 21]);
    assert.ok(c.requests.some((r) => r.path === "/chat/2?after=20"));
});

test("leaving and reopening the same conversation discards the previous view's response", async () => {
    const c = await createClient();
    c.state.threads.set(1, thread(1, [message(10)]));
    c.state.threads.set(2, thread(2, [message(20)]));
    await c.openChat();
    const delayed = c.pause((path) => /^\/chat\/1(?:\?|$)/.test(path));
    const opening = c.openThread(1);
    await flush();
    await c.openThread(2);
    c.state.threads.get(1).messages.push(message(11));
    c.state.threads.get(1).conversation.nick = "Updated player";
    await c.openThread(1);
    delayed.release();
    await opening;
    assert.equal(c.$("#chat-name").textContent, "Updated player");
    assert.deepEqual(c.ids(), [10, 11]);
});

test("a delayed send confirmation cannot insert a message into another conversation", async () => {
    const c = await createClient();
    c.state.threads.set(1, thread(1, [message(10)]));
    c.state.threads.set(2, thread(2, [message(20)]));
    await c.openChat();
    await c.openThread(1);
    const delayed = c.pause((path, body) => path === "/chat/1" && body);
    const sending = c.send("only for Player 1");
    await flush();
    await c.openThread(2);
    delayed.release();
    await sending;
    assert.equal(c.$("#chat-name").textContent, "Player 2");
    assert.deepEqual(c.ids(), [20]);
    assert.equal(c.state.threads.get(1).messages.at(-1).content, "only for Player 1");
});

test("a failed send from an old conversation cannot overwrite a new draft", async () => {
    const c = await createClient();
    c.state.threads.set(1, thread(1));
    c.state.threads.set(2, thread(2));
    await c.openChat();
    await c.openThread(1);
    const delayed = c.pause((path, body) => path === "/chat/1" && body);
    const sending = c.send("old draft");
    await flush();
    await c.openThread(2);
    c.$("textarea").value = "new draft";
    delayed.reject(new Error("send failed"));
    await sending;
    assert.equal(c.$("textarea").value, "new draft");
    assert.deepEqual(c.toasts, []);
});

test("unread notifications refresh while the chat is closed", async () => {
    const c = await createClient();
    c.state.unread = 3;
    const before = c.requests.length;
    await c.tick();
    assert.equal(c.$("#chat").hidden, true);
    assert.equal(c.$("#chat-badge").hidden, false);
    assert.equal(c.$("#chat-badge").textContent, "3");
    assert.deepEqual(c.requests.slice(before).map((r) => r.path), ["/chat/unread"]);
});

test("the visible inbox refreshes new conversations, previews, unread counts and ordering", async () => {
    const c = await createClient();
    await c.openChat();
    assert.ok(c.$("#chat-list").innerHTML.includes("chat-empty"));
    c.state.conversations = [
        { id: 1, nick: "Kuba", content: "first preview", unread: 2 },
        { id: 2, nick: "Tomek", content: "second preview", unread: 0 },
    ];
    await c.tick();
    assert.ok(c.$("#chat-list").innerHTML.includes('data-open-chat="1"'));
    assert.ok(c.$("#chat-list").innerHTML.includes("first preview"));
    assert.ok(c.$("#chat-list").innerHTML.includes("<i>2</i>"));
    assert.equal(c.$("#chat-badge").textContent, "2");
    c.state.conversations.reverse();
    c.state.conversations[0].content = "latest preview";
    c.state.conversations[0].unread = 1;
    await c.tick();
    const html = c.$("#chat-list").innerHTML;
    assert.ok(html.indexOf('data-open-chat="2"') < html.indexOf('data-open-chat="1"'));
    assert.ok(html.includes("latest preview"));
    assert.equal(c.$("#chat-badge").textContent, "3");
});

test("pending unread responses cannot restore notifications after logout", async () => {
    const c = await createClient();
    c.state.unread = 3;
    const delayed = c.pause((path) => path === "/chat/unread");
    const polling = c.tick();
    await flush();
    c.context.currentUser = null;
    await c.document.emit("cgp:user");
    delayed.release();
    await polling;
    assert.equal(c.$("#chat-badge").hidden, true);
    assert.equal(c.$("#chat").hidden, true);
    const before = c.requests.length;
    await c.tick();
    assert.equal(c.requests.length, before);
});

test("slow polling never starts another periodic request in parallel", async () => {
    const c = await createClient();
    const delayed = c.pause((path) => path === "/chat/unread");
    const first = c.tick();
    await flush();
    const before = c.requests.length;
    await Promise.all([c.tick(), c.tick()]);
    assert.equal(c.requests.length, before);
    delayed.release();
    await first;
});
