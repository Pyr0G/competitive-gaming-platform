import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import core from "../frontend/i18n-core.js";
import { catalogs, failure, message, translateRequest } from "./i18n.js";
import { createClientTranslations } from "./client-test-support.js";

const frontend = (file) => readFileSync(new URL("../frontend/" + file, import.meta.url), "utf8");
const runtime = frontend("i18n.js");
const placeholders = (value) => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();

test("English and Polish catalogs have matching keys, placeholders and complete plural forms", () => {
    assert.deepEqual(Object.keys(catalogs.en).sort(), Object.keys(catalogs.pl).sort());
    for (const [key, english] of Object.entries(catalogs.en)) {
        const polish = catalogs.pl[key];
        assert.equal(typeof polish, typeof english, key);
        const variants = typeof english === "string" ? [english, polish] : [...Object.values(english), ...Object.values(polish)];
        if (typeof english === "object") {
            assert.ok(english.one && english.other, key);
            assert.ok(polish.one && polish.few && polish.many && polish.other, key);
        }
        for (const value of variants) {
            assert.equal(typeof value, "string", key);
            assert.ok(value.trim(), key);
            assert.deepEqual(placeholders(value), placeholders(variants[0]), key);
            assert.doesNotMatch(value, /[–—·]/, key);
            assert.doesNotMatch(value.replace(/<\/?(?:b|strong|em|code)>/g, ""), /<[^>]*>/, key);
        }
    }
});

test("all literal translation references resolve in both catalogs", () => {
    const prefixes = [...new Set(Object.keys(catalogs.en).map((key) => key.split(".")[0]))].join("|");
    const pattern = new RegExp('["\\x27]((?:' + prefixes + ')\\.[A-Za-z][A-Za-z0-9]*)["\\x27]', "g");
    for (const file of ["app.js", "chat.js", "admin.js", "veto.js", "i18n.js", "i18n-core.js", "accessibility.js"]) {
        for (const [, key] of frontend(file).matchAll(pattern)) assert.ok(Object.hasOwn(catalogs.en, key), file + ": " + key);
    }
    for (const file of ["auth.js", "api.js", "chat.js", "admin.js", "server.js", "resource-limits.js", "api-rate-limit.js"]) {
        const source = readFileSync(new URL(file, import.meta.url), "utf8");
        for (const [, key] of source.matchAll(pattern)) assert.ok(Object.hasOwn(catalogs.en, key), file + ": " + key);
    }
    for (const [, key] of frontend("index.html").matchAll(/(?:data-i18n|data-i18n-html)="([^"]+)"/g)) assert.ok(Object.hasOwn(catalogs.en, key), key);
    for (const [, pairs] of frontend("index.html").matchAll(/data-i18n-attr="([^"]+)"/g)) {
        for (const pair of pairs.split(";")) assert.ok(Object.hasOwn(catalogs.en, pair.split(":")[1]), pair);
    }
});

test("page text and accessible attributes are catalog-backed except identifiers and the no-script fallback", () => {
    const html = frontend("index.html").replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
    const identifiers = new Set(["cgp.gg/", "Kuba", "kuba@example.com", "FACEIT 6+", "PLS", "Pół Składu", "O", "Ola", "Tomek", "faceit.com/en/cs2/room/1-8f3c2a71", "Ekipa z Akademika", "FACEIT", "K", "kuba_entry", "ola_supp", "W", "Wojtek", "wojtek_awp", "BO1", "BO3"]);
    for (const [, text] of html.matchAll(/>([^<>]+)</g)) {
        const value = text.trim();
        if (/\p{L}/u.test(value)) assert.ok(identifiers.has(value), "Untranslated page text: " + value);
    }
    for (const [, name, value] of html.matchAll(/\b(aria-label|placeholder|title|alt)="([^"]+)"/g)) {
        assert.ok(value === "CGP" || value.startsWith("https://www.faceit.com/"), name + ": " + value);
    }
});

test("the region sets the automatic language while an explicit language always wins", () => {
    for (const [preferences, expected] of [
        [{}, ["en", "GB"]],
        [{ locales: ["pl-PL"] }, ["pl", "PL"]],
        [{ locales: ["en-PL"] }, ["pl", "PL"]],
        [{ locales: ["de-DE", "pl-PL"] }, ["en", "DE"]],
        [{ locales: ["pl"] }, ["pl", "PL"]],
        [{ language: "en", region: "PL", locales: ["pl-PL"] }, ["en", "PL"]],
        [{ language: "pl", region: "US" }, ["pl", "US"]],
        [{ language: "xx", region: "invalid", locales: ["invalid_tag", "*"] }, ["en", "GB"]],
    ]) {
        const result = core.resolve(preferences);
        assert.deepEqual([result.language, result.region], expected);
    }
    assert.equal(new Set(core.regionCodes).size, 249);
    assert.equal(core.regionCodes.length, 249);
});

test("localization uses Intl for dates, numbers, currencies, lists and relative time", () => {
    for (const [language, region] of [["en", "US"], ["en", "GB"], ["pl", "PL"]]) {
        const i18n = core.create(catalogs, { language, region });
        const locale = language + "-" + region;
        const date = "2026-11-14T15:30:00Z";
        const options = { dateStyle: "short", timeStyle: "short", timeZone: "UTC" };
        assert.equal(i18n.date(date, options), new Intl.DateTimeFormat(locale, options).format(new Date(date)));
        assert.equal(i18n.number(12345.6), new Intl.NumberFormat(locale).format(12345.6));
        assert.equal(i18n.currency(25, "PLN"), new Intl.NumberFormat(locale, { style: "currency", currency: "PLN" }).format(25));
        assert.equal(i18n.relative(-2, "day"), new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-2, "day"));
        assert.equal(i18n.list(["A", "B"]), new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(["A", "B"]));
        assert.equal(i18n.date("invalid"), i18n.t("common.toBeConfirmed"));
        assert.equal(i18n.date(null), i18n.t("common.toBeConfirmed"));
    }
});

test("Polish plural rules cover zero, one, few and many without splitting sentences", () => {
    const pl = core.create(catalogs, { language: "pl" });
    for (const [count, expected] of [[0, "Dostępnych 0 miejsc"], [1, "Dostępne 1 miejsce"], [2, "Dostępne 2 miejsca"], [5, "Dostępnych 5 miejsc"], [12, "Dostępnych 12 miejsc"], [22, "Dostępne 22 miejsca"]]) {
        assert.equal(pl.t("tournaments.places", { count }), expected);
    }
});

test("ranking calculations and result styling remain independent of translated win and loss labels", () => {
    const app = frontend("app.js");
    const source = app.slice(app.indexOf("const renderRanking ="), app.indexOf("const placesLeft =")) + "\nrenderRanking();";
    const matches = [true, true, true, false].map((win) => ({ a: "AAA", b: "BBB", sa: win ? 13 : 7, sb: win ? 7 : 13, map: "Mirage" }));
    const render = (language) => {
        const elements = new Map();
        vm.runInNewContext(source, {
            ...createClientTranslations(language),
            $: (selector) => {
                if (!elements.has(selector)) elements.set(selector, { innerHTML: "" });
                return elements.get(selector);
            },
            TEAMS: { AAA: "Alpha", BBB: "Beta" },
            TOURNAMENTS: [{ status: "done", champion: "AAA" }],
            finishedMatches: () => matches, trophy: "", esc: core.escape,
        });
        return { rows: elements.get("#r-body").innerHTML, facts: elements.get("#r-facts").innerHTML };
    };
    const english = render("en");
    const polish = render("pl");
    assert.equal([...english.rows.matchAll(/class="f-win"/g)].length, 4);
    assert.equal([...polish.rows.matchAll(/class="f-win"/g)].length, 4);
    assert.equal([...english.rows.matchAll(/class="f-loss"/g)].length, 4);
    assert.equal([...polish.rows.matchAll(/class="f-loss"/g)].length, 4);
    assert.match(english.facts, /3 consecutive wins/);
    assert.match(polish.facts, /3 z rzędu/);
});

test("rich messages escape user content, allow only simple catalog markup and fall back to English", () => {
    const i18n = core.create({ en: { hello: "<b>{name}</b>", unsafe: '<img src=x onerror=alert(1)> {name}' }, pl: {} }, { language: "pl" });
    const name = '<img src=x onerror="alert(1)">';
    assert.equal(i18n.t("hello", { name }), name);
    assert.equal(i18n.html("hello", { name }), "<b>" + core.escape(name) + "</b>");
    assert.ok(i18n.html("unsafe", { name }).startsWith("&lt;img"));
    assert.equal(i18n.t("missing.key"), "missing.key");
});

test("API messages negotiate language, ignore invalid and excluded locales, and expose stable message keys", () => {
    const request = { headers: { "accept-language": "en-US;q=0, pl-PL;q=0.9, de-DE;q=0.5" } };
    assert.equal(translateRequest(request).language, "pl");
    assert.equal(translateRequest({ headers: { "accept-language": "???,*" } }).language, "en");
    assert.equal(translateRequest({ headers: { "x-cgp-language": "en", "x-cgp-region": "PL" } }).language, "en");
    assert.deepEqual(failure(request, "error.signIn"), { error: "Zaloguj się, aby kontynuować.", errorKey: "error.signIn", values: {} });
    assert.equal(message(request, "auth.registered", { email: "name@example.com" }).messageKey, "auth.registered");
});

const createRuntime = ({
    locales = ["en-GB"],
    language = "en-GB",
    saved = {},
    search = "",
    blockedStorage = false
} = {}) => {
    const storage = new Map(Object.entries(saved));
    const events = [];
    const elements = [];
    const matches = (element, selector) => Object.hasOwn(element.dataset, selector.slice(6, -1).replace(/-([a-z])/g, (_, char) => char.toUpperCase()));
    const document = {
        documentElement: {}, title: "",
        querySelectorAll: (selector) => elements.filter((element) => matches(element, selector)),
        getElementById: () => null,
        dispatchEvent: (event) => events.push(event),
    };
    const listeners = {};
    const window = { CGP_LOCALE: core, CGP_LOCALES: catalogs, addEventListener: (name, handler) => { listeners[name] = handler; } };
    const context = vm.createContext({
        window, document, navigator: { languages: locales, language }, location: { search }, URLSearchParams,
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
        localStorage: {
            getItem: (key) => { if (blockedStorage) throw new Error("Storage blocked"); return storage.get(key) || null; },
            setItem: (key, value) => { if (blockedStorage) throw new Error("Storage blocked"); storage.set(key, value); },
            removeItem: (key) => { if (blockedStorage) throw new Error("Storage blocked"); storage.delete(key); },
        },
    });
    vm.runInContext(runtime, context);
    return { i18n: window.CGP_I18N, document, elements, events, storage, listeners };
};

test("language changes translate labels, attributes and messages without changing user-entered content", () => {
    const runtime = createRuntime({ locales: ["pl-PL"] });
    const label = { dataset: { i18n: "field.email" }, textContent: "" };
    const input = { dataset: { i18nAttr: "placeholder:auth.emailPlaceholder;aria-label:field.email" }, value: "my draft", attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
    const message = { dataset: {}, innerHTML: "" };
    runtime.elements.push(label, input, message);
    runtime.i18n.bind(message, "auth.signedIn", { nick: "<b>Player</b>" }, true);
    runtime.i18n.setLanguage("en");
    assert.equal(label.textContent, "Email address");
    assert.equal(input.value, "my draft");
    assert.equal(input.attributes["aria-label"], "Email address");
    assert.match(message.innerHTML, /&lt;b&gt;Player&lt;\/b&gt;/);
    assert.equal(runtime.document.documentElement.lang, "en");
    assert.equal(runtime.storage.get("cgp-language"), "en");
    assert.equal(runtime.events.at(-1).detail.locale, "en-PL");
    runtime.i18n.setRegion("US");
    assert.equal(runtime.i18n.language, "en");
    runtime.i18n.setLanguage("");
    runtime.i18n.setRegion("PL");
    assert.equal(runtime.i18n.language, "pl");
});

test("storage failures do not prevent language changes and saved preferences override email link defaults", () => {
    const blocked = createRuntime({ blockedStorage: true, locales: ["pl-PL"] });
    blocked.i18n.setLanguage("en");
    blocked.i18n.setRegion("US");
    assert.equal(blocked.i18n.locale, "en-US");
    const saved = createRuntime({ saved: { "cgp-language": "en" }, search: "?lang=pl&region=PL" });
    assert.equal(saved.i18n.locale, "en-PL");
    const fresh = createRuntime({ search: "?reset=token&lang=pl&region=PL" });
    assert.equal(fresh.i18n.locale, "pl-PL");
    fresh.storage.set("cgp-language", "en");
    fresh.listeners.storage({ key: "cgp-language" });
    assert.equal(fresh.i18n.language, "en");
});

test("browser locale detection falls back to navigator.language", () => {
    const fallback = createRuntime({
        locales: [],
        language: "pl-PL"
    });

    assert.equal(fallback.i18n.locale, "pl-PL");

    const unavailable = createRuntime({
        locales: [],
        language: ""
    });

    assert.equal(unavailable.i18n.locale, "en-GB");
});