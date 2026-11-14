const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const I18N = window.CGP_I18N;
const tx = (key, values) => I18N.t(key, values);
const tr = (key, values) => I18N.fragment(key, values);
const localizedResponse = (data) => data.messageKey ? tr(data.messageKey, data.values) : esc(data.message || "");
const localizedError = (error) => error.data?.errorKey ? tr(error.data.errorKey, error.data.values) : esc(error.message);
const dateTime = (value) => I18N.formatDate(value, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const num = (value) => `<span data-i18n-number="${Number(value) || 0}">${I18N.formatNumber(Number(value) || 0)}</span>`;

const intro = $("#intro");
let introSeen = false;
try { introSeen = Boolean(sessionStorage.getItem("cgp-intro")); } catch {}
const introDelay = introSeen || reducedMotion ? 0 : 1100;

if (introDelay) {
    document.documentElement.style.setProperty("--intro", `${introDelay / 1000}s`);
    try { sessionStorage.setItem("cgp-intro", "1"); } catch {}
    setTimeout(() => intro.classList.add("done"), introDelay + 100);
} else {
    intro.classList.add("skip");
}

const topbar = $("#topbar");
const progress = $("#progress");

const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    topbar.classList.toggle("scrolled", window.scrollY > 20);
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
};

window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const nav = $("#nav");
const burger = $("#burger");
const mobileNav = window.matchMedia("(max-width: 1180px)");
const syncNavigation = () => { nav.inert = mobileNav.matches && !nav.classList.contains("open"); };
mobileNav.addEventListener("change", syncNavigation);
syncNavigation();

burger.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", open);
    syncNavigation();
});

$$("a", nav).forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("open");
    burger.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    syncNavigation();
}));
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !nav.classList.contains("open")) return;
    nav.classList.remove("open");
    burger.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    syncNavigation();
    burger.focus();
});

const spyLinks = $$("[data-spy]");
const ink = $("#nav-ink");
let hovered = null;

const moveInk = () => {
    const target = hovered || $(".nav a.active");
    ink.classList.toggle("on", Boolean(target));
    if (!target) return;
    ink.style.width = `${target.offsetWidth - 20}px`;
    ink.style.transform = `translateX(${target.offsetLeft + 10}px)`;
};

spyLinks.forEach((link, i) => {
    link.style.setProperty("--i", i);
    link.addEventListener("pointerenter", () => {
        hovered = link;
        moveInk();
    });
});

nav.addEventListener("pointerleave", () => {
    hovered = null;
    moveInk();
});

window.addEventListener("resize", moveInk);
document.fonts?.ready.then(moveInk);

const spyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        spyLinks.forEach((link) => link.classList.toggle("active", link.dataset.spy === entry.target.id));
    });
    moveInk();
}, { rootMargin: "-45% 0px -50% 0px" });

spyLinks.forEach((link) => spyObserver.observe(document.getElementById(link.dataset.spy)));

new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) spyLinks.forEach((link) => link.classList.remove("active"));
    moveInk();
}, { rootMargin: "-45% 0px -50% 0px" }).observe($("#top"));

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

const observeReveal = (root = document) => $$(".reveal:not(.visible)", root).forEach((el) => revealObserver.observe(el));
observeReveal();

setTimeout(() => {
    $$("[data-count]").forEach((el) => {
        const target = Number(el.dataset.count);
        if (reducedMotion) {
            el.textContent = I18N.formatNumber(target);
            return;
        }
        const start = performance.now();

        const tick = (now) => {
            const p = Math.min((now - start) / 1200, 1);
            el.textContent = I18N.formatNumber(Math.round(target * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    });
}, reducedMotion ? 0 : introDelay + 800);

const glyphs = "ABCDEFGHIJKLMNOPRSTUWYZ0123456789#%&*/";

const scramble = (el) => {
    if (el.dataset.busy) return;
    el.dataset.busy = "1";
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    const language = I18N.language;
    let frame = 0;
    const total = 22;

    const step = () => {
        if (language !== I18N.language) {
            delete el.dataset.busy;
            el.textContent = tx(el.dataset.i18n);
            return;
        }
        const revealed = Math.floor((frame / total) * final.length);
        el.textContent = [...final].map((ch, i) => {
            if (ch === " " || i < revealed) return ch;
            return glyphs[Math.floor(Math.random() * glyphs.length)];
        }).join("");
        frame++;
        if (frame <= total) {
            setTimeout(step, 35);
        } else {
            el.textContent = final;
            delete el.dataset.busy;
        }
    };

    step();
};

$$("[data-scramble]").forEach((el) => {
    if (!reducedMotion) setTimeout(() => scramble(el), introDelay + 700);
    if (!reducedMotion) el.addEventListener("mouseenter", () => scramble(el));
});

const hero = $("#top");
const crosshair = $("#crosshair");
const hits = $("#hits");
const canAim = window.matchMedia("(pointer: fine)").matches && !reducedMotion;

const heroVideo = $("#hero-video");
const saveData = navigator.connection && navigator.connection.saveData;
const useVideo = !reducedMotion && !saveData && window.innerWidth >= 900;

if (useVideo) {
    heroVideo.src = heroVideo.dataset.src;
    heroVideo.addEventListener("playing", () => heroVideo.classList.add("playing"), { once: true });
}

const pauseObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        entry.target.classList.toggle("off-screen", !entry.isIntersecting);
        if (entry.target === hero && useVideo) {
            if (entry.isIntersecting) heroVideo.play().catch(() => {});
            else heroVideo.pause();
        }
    });
});

[hero, $(".ticker"), $(".tutorial"), $("#drabinka")].forEach((el) => el && pauseObserver.observe(el));

if (canAim) {
    let aim = null;

    hero.addEventListener("pointermove", (e) => {
        const first = !aim;
        aim = { x: e.clientX, y: e.clientY, overUi: Boolean(e.target.closest("a, button, h1, p, .stats")) };
        if (!first) return;
        requestAnimationFrame(() => {
            hero.classList.toggle("aiming", !aim.overUi);
            crosshair.classList.toggle("on", !aim.overUi);
            crosshair.style.transform = `translate(${aim.x}px, ${aim.y}px)`;
            aim = null;
        });
    });

    hero.addEventListener("pointerleave", () => {
        hero.classList.remove("aiming");
        crosshair.classList.remove("on");
    });

    hero.addEventListener("click", (e) => {
        if (!hero.classList.contains("aiming")) return;
        crosshair.classList.add("recoil");
        setTimeout(() => crosshair.classList.remove("recoil"), 110);

        const hole = document.createElement("span");
        hole.className = "hit-hole";
        hole.style.left = `${e.clientX}px`;
        hole.style.top = `${e.clientY}px`;

        const marker = document.createElement("span");
        marker.className = "hit";
        marker.style.left = `${e.clientX}px`;
        marker.style.top = `${e.clientY}px`;

        hits.append(hole, marker);
        setTimeout(() => marker.remove(), 700);
        setTimeout(() => hole.remove(), 2500);
    });

    window.addEventListener("scroll", () => {
        $$(".hit-hole", hits).forEach((hole) => hole.remove());
    }, { passive: true });
}

const steps = $("#steps");
const stepButtons = $$(".step", steps);
const panes = $$(".pane");
const screenPath = $("#screen-path");
const tutorial = $(".tutorial");

let tutorialStarted = false;

const showStep = (index) => {
    stepButtons.forEach((btn, i) => btn.classList.toggle("active", i === index));
    panes.forEach((pane, i) => {
        pane.classList.remove("active");
        if (i === index) {
            void pane.offsetWidth;
            pane.classList.add("active");
        }
    });
    I18N.bind(screenPath, ["how.path.register", "how.path.recruitment", "how.path.chat", "how.path.results"][index]);
    stepButtons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    panes.forEach((pane, i) => { pane.inert = i !== index; });
};

stepButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
        tutorialStarted = true;
        showStep(i);
    });
    $(".step-bar i", btn).addEventListener("animationend", () => {
        if (btn.classList.contains("active")) showStep((i + 1) % stepButtons.length);
    });
});

steps.classList.add("paused");
tutorial.addEventListener("mouseenter", () => steps.classList.add("paused"));
tutorial.addEventListener("mouseleave", () => steps.classList.remove("paused"));

new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !tutorialStarted) {
        tutorialStarted = true;
        showStep(0);
    }
    if (!tutorial.matches(":hover")) steps.classList.toggle("paused", !entry.isIntersecting);
}, { threshold: 0.35 }).observe(tutorial);

const pad = (n) => I18N.formatNumber(n, { minimumIntegerDigits: 2, useGrouping: false });

const renderCountdowns = () => {
    $$(".countdown[data-deadline]").forEach((el) => {
        const diff = new Date(el.dataset.deadline) - Date.now();
        if (diff <= 0) {
            el.className = "countdown closed";
            el.textContent = tx("countdown.closed");
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor(diff / 3600000) % 24;
        const m = Math.floor(diff / 60000) % 60;
        const s = Math.floor(diff / 1000) % 60;
        el.innerHTML = `<p class="countdown-title">${tr("countdown.title")}</p>
            <div><b>${I18N.formatNumber(d)}</b><span>${tr("countdown.days", { count: d })}</span></div>
            <div><b>${pad(h)}</b><span>${tr("countdown.hours", { count: h })}</span></div>
            <div><b>${pad(m)}</b><span>${tr("countdown.minutes")}</span></div>
            <div><b>${pad(s)}</b><span>${tr("countdown.seconds")}</span></div>`;
    });
};

renderCountdowns();
setInterval(renderCountdowns, 1000);

const tList = $("#tournaments");
const tTabs = $$("#t-tabs .tab");
const CARD_IMAGES = ["setup-sm", "lan-sm", "keyboard-sm", "hero-sm"];
let tFilter = "all";

const slotsGrid = (filled, total) => `<div class="slots-grid" style="grid-template-columns: repeat(${Math.min(total, 8)}, 1fr)">${Array.from({ length: total }, (_, k) => `<i class="${k < filled ? "full" : ""}" style="--k: ${k}"></i>`).join("")}</div>
    <p class="slots-label">${tr("tournaments.slots", { filled: I18N.formatNumber(filled), total: I18N.formatNumber(total) })}</p>`;

const signupButton = () => `<button type="button" class="btn btn-glow" disabled>${tr("tournaments.register")}</button>`;

const tCard = (t, i) => {
    const matches = (t.rounds || []).flat().filter((m) => !m.bye);
    const played = matches.filter((m) => m.state === "done").length;
    const count = t.registered ? t.registered.length : t.teams;
    const bracketButton = (label, ghost) => `<button type="button" class="btn ${ghost ? "btn-ghost" : ""} ${t.status === "open" ? "" : "btn-full"}" data-show-bracket="${esc(t.id)}">${label}</button>`;
    let badge;
    let meta;
    let extra;
    let actions;

    if (t.status === "open") {
        badge = `<span class="badge badge-open">${tr("tournaments.registrationOpen")}</span>`;
        meta = [[tx("common.start"), dateTime(t.start)], [tx("tournaments.available"), placesLeft(Math.max(0, t.slots - count))], [tx("tournaments.maps"), tx("tournaments.activePool")]];
        extra = `${slotsGrid(count, t.slots)}<div class="countdown" data-deadline="${esc(t.deadline)}"></div>`;
        actions = bracketButton(tx("tournaments.registered"), true) + signupButton();
    } else if (t.status === "live") {
        const stage = t.rounds ? t.rounds.findIndex((r) => r.some((m) => m.state !== "done")) : -1;
        badge = `<span class="badge badge-live"><span class="live-dot"></span>${tr("status.live")}</span>`;
        meta = [
            [tx("common.start"), dateTime(t.start)],
            [tx("tournaments.stage"), t.rounds ? roundName(stage < 0 ? t.rounds.length - 1 : stage, t.rounds.length) : tx("tournaments.draw")],
            [tx("tournaments.matches"), `${played} / ${matches.length}`],
        ];
        extra = slotsGrid(count, t.slots);
        actions = bracketButton(tx("tournaments.viewBracket"));
    } else {
        const final = t.rounds?.at(-1)?.[0];
        badge = `<span class="badge badge-done">${tr("match.completed")}</span>`;
        meta = [[tx("tournaments.held"), I18N.formatDate(t.start, { dateStyle: "medium" })], [tx("tournaments.teams"), `${I18N.formatNumber(count)} / ${I18N.formatNumber(t.slots)}`], [tx("tournaments.final"), final?.state === "done" && !final.bye ? `${final.sa}:${final.sb}` : "-"]];
        extra = t.champion
            ? `<div class="winner">${trophy}<span>${tr("tournaments.winner")}</span><b>${esc(TEAMS[t.champion])}</b></div>`
            : `<p class="slots-label">${tr("tournaments.noWinner")}</p>`;
        actions = bracketButton(tx("tournaments.viewBracket"), true);
    }

    return `<article class="t-card reveal" data-status="${t.status}" style="--img: url('assets/${CARD_IMAGES[i % CARD_IMAGES.length]}.jpg')">
        <div class="t-card-img"><span class="t-game">${tr("tournaments.game")}</span></div>
        <div class="t-card-body">
            <div class="t-card-top">${badge}<span class="format">${esc(t.format)}</span></div>
            <h3>${esc(t.name)}</h3>
            <ul class="meta">${meta.map(([key, value]) => `<li><span>${key}</span>${esc(value)}</li>`).join("")}</ul>
            ${extra}
            <div class="t-card-actions">${actions}</div>
        </div>
    </article>`;
};

const applyTFilter = () => $$(".t-card", tList).forEach((card) => card.classList.toggle("hidden", tFilter !== "all" && card.dataset.status !== tFilter));

const renderCards = () => {
    tList.innerHTML = TOURNAMENTS.map(tCard).join("");
    tTabs.forEach((tab) => {
        const filter = tab.dataset.filter;
        $(".tab-count", tab).textContent = I18N.formatNumber(filter === "all" ? TOURNAMENTS.length : TOURNAMENTS.filter((t) => t.status === filter).length);
        tab.setAttribute("aria-pressed", String(filter === tFilter));
    });
    applyTFilter();
    observeReveal(tList);
    renderCountdowns();
};

tTabs.forEach((tab) => tab.addEventListener("click", () => {
    tFilter = tab.dataset.filter;
    tTabs.forEach((t) => t.classList.toggle("active", t === tab));
    tTabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
    applyTFilter();
}));

tList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-show-bracket]");
    if (!btn) return;
    selectTournament(btn.dataset.showBracket);
    $("#drabinka").scrollIntoView({ behavior: "smooth" });
});

if (canAim) {
    tList.addEventListener("pointermove", (e) => {
        const card = e.target.closest(".t-card");
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 6}deg`);
        card.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -6}deg`);
    });
    tList.addEventListener("pointerout", (e) => {
        const card = e.target.closest(".t-card");
        if (!card || card.contains(e.relatedTarget)) return;
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
    });
}

$("#ads").addEventListener("pointermove", (e) => {
    const card = e.target.closest(".ad");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
});

const filters = $("#filters");
let ads = $$(".ad");

const applyFilters = () => {
    const role = filters.role.value;
    const time = filters.time.value;
    const [min, max] = filters.level.value ? filters.level.value.split("-").map(Number) : [1, 10];
    let shown = 0;

    ads.forEach((ad) => {
        const level = Number(ad.dataset.level);
        const match = (!role || ad.dataset.role === role) && level >= min && level <= max && (!time || ad.dataset.time.split(" ").includes(time));
        ad.classList.toggle("hidden", !match);
        if (match) shown++;
    });

    I18N.bind($("#ads-count"), "ads.count", { count: I18N.formatNumber(shown) }, true);
    $("#ads-empty").hidden = shown > 0;
};

filters.addEventListener("change", applyFilters);
applyFilters();

let TEAMS = {
    AKD: "Ekipa z Akademika",
    CBS: "Cebulowe Smoki",
    NCM: "Nocne Marki",
    SGM: "Sigma Squad",
    PLS: "Pół Składu",
    BYW: "Bydgoskie Wilki",
    KIK: "Kawa i Klawiatura",
    SES: "Sesja Survivors",
};

const fakeId = (seed) => {
    let h = 2166136261;
    let out = "";
    for (let i = 0; out.length < 32; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i % seed.length) ^ i, 16777619) >>> 0;
        out += h.toString(16).padStart(8, "0");
    }
    out = out.slice(0, 32);
    return `1-${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20, 32)}`;
};

const done = (a, b, sa, sb, map, time) => ({ a, b, sa, sb, map, time, state: "done", faceit: fakeId(a + b + map) });

let TOURNAMENTS = [
    {
        id: "puchar",
        name: "Puchar Akademika #1",
        status: "live",
        format: "BO1",
        start: "2026-10-24T18:00:00+02:00",
        slots: 8,
        teams: 4,
        rounds: [
            [
                { ...done("AKD", "CBS", 13, 8, "Mirage", "2026-10-24T18:00:00+02:00"), faceit: "1-8f3c2a71-4b6e-4d2a-9c11-2e7f5d9a0b43" },
                { a: "NCM", b: "SGM", map: "Inferno", time: "2026-10-24T19:30:00+02:00", state: "pending" },
            ],
            [
                { a: "AKD", b: null, map: null, time: "2026-10-27T20:00:00+01:00", state: "scheduled" },
            ],
        ],
    },
    {
        id: "sesja",
        name: "Sesja Cup",
        status: "open",
        format: "BO1",
        start: "2026-11-08T18:00:00+01:00",
        slots: 8,
        registered: ["AKD", "PLS", "BYW", "KIK", "SES"],
        deadline: "2026-11-07T18:00:00+01:00",
    },
    {
        id: "nocny",
        name: "Nocny Turniej BO3",
        status: "open",
        format: "BO3",
        start: "2026-11-15T18:00:00+01:00",
        slots: 16,
        registered: ["NCM"],
        deadline: "2026-11-14T18:00:00+01:00",
    },
    {
        id: "otwarcie",
        name: "Turniej Otwarcia",
        status: "done",
        format: "BO1",
        start: "2026-10-17T17:00:00+02:00",
        slots: 8,
        teams: 8,
        champion: "SGM",
        rounds: [
            [
                done("SGM", "KIK", 13, 4, "Mirage", "2026-10-17T17:00:00+02:00"),
                done("NCM", "BYW", 11, 13, "Nuke", "2026-10-17T17:00:00+02:00"),
                done("AKD", "SES", 13, 9, "Ancient", "2026-10-17T18:15:00+02:00"),
                done("CBS", "PLS", 16, 14, "Inferno", "2026-10-17T18:15:00+02:00"),
            ],
            [
                done("SGM", "BYW", 13, 7, "Anubis", "2026-10-17T19:30:00+02:00"),
                done("AKD", "CBS", 10, 13, "Dust2", "2026-10-17T19:30:00+02:00"),
            ],
            [
                done("SGM", "CBS", 13, 11, "Mirage", "2026-10-17T21:00:00+02:00"),
            ],
        ],
    },
];

const STATUS = {
    live: { label: "status.live", dot: "dot-live", badge: "badge-live" },
    open: { label: "status.open", dot: "dot-open", badge: "badge-open" },
    done: { label: "match.completed", dot: "dot-done", badge: "badge-done" },
};

const MATCH_STATE = {
    done: "match.completed",
    pending: "match.pending",
    scheduled: "match.scheduled",
    ready: "match.ready",
};

const trophy = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v3h3v2a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.6 13 5 5 0 0 1 4 8V6h3V3zm-1 5c0 1.2.8 2.3 2 2.7V8H6zm12 0h-2v2.7c1.2-.4 2-1.5 2-2.7z" /></svg>`;

const bTabs = $("#b-tabs");
const bInfo = $("#b-info");
const bracket = $("#bracket");
const bPanel = $("#b-panel");
let current = TOURNAMENTS[0];
let selected = null;

const roundName = (i, total) => tx(["tournaments.final", "bracket.semifinals", "bracket.quarterfinals"][total - i - 1] || "bracket.round", { number: I18N.formatNumber(i + 1) });
const winnerOf = (m) => {
    if (m.state !== "done") return null;
    if (m.bye) return m.a || m.b;
    return m.sa > m.sb ? m.a : m.b;
};

const teamRow = (code, score, m) => {
    if (!code) return `<div class="team tbd"><span class="team-tag">?</span><span class="team-name">${m.bye ? tx("bracket.bye") : tx("common.toBeConfirmed")}</span><b>-</b></div>`;
    const win = winnerOf(m);
    const cls = win ? (win === code ? "win" : "lose") : "";
    return `<div class="team ${cls}" data-team="${esc(code)}"><span class="team-tag">${esc(code)}</span><span class="team-name">${esc(TEAMS[code])}</span><b>${score ?? "-"}</b></div>`;
};

const renderTabs = () => {
    bTabs.innerHTML = TOURNAMENTS.map((t) => `<button type="button" class="tab ${t === current ? "active" : ""}" aria-pressed="${t === current}" data-id="${esc(t.id)}"><i class="dot ${STATUS[t.status].dot}"></i>${esc(t.name)}</button>`).join("");
};

const renderInfo = () => {
    const t = current;
    const count = t.registered ? t.registered.length : t.teams;
    bInfo.innerHTML = `<h3>${esc(t.name)}</h3>
        <span class="badge ${STATUS[t.status].badge}">${tr(STATUS[t.status].label)}</span>
        <span>${tr("common.format")} <b>${esc(t.format)}</b></span>
        <span>${tr("common.start")} <b>${dateTime(t.start)}</b></span>
        <span>${tr("tournaments.teams")} <b>${I18N.formatNumber(count)} / ${I18N.formatNumber(t.slots)}</b></span>`;
};

const renderBracket = () => {
    const t = current;

    if (!t.rounds) {
        const slots = Array.from({ length: t.slots }, (_, i) => {
            const code = t.registered[i];
            return code ? `<div><span class="team-tag">${esc(code)}</span>${esc(TEAMS[code])}</div>` : `<div class="empty-slot">${tr("bracket.vacant")}</div>`;
        }).join("");
        bracket.innerHTML = `<div class="signup">
            <p>${tr("bracket.registrationHelp")}</p>
            <div class="countdown" data-deadline="${t.deadline}"></div>
            <div class="signup-grid">${slots}</div>
        </div>`;
        renderCountdowns();
        return;
    }

    const rows = t.rounds[0].length;
    const last = t.rounds.length - 1;
    const rounds = t.rounds.map((round, ri) => {
        const matches = round.map((m, mi) => {
            const classes = ["mw"];
            if (ri < last) classes.push("out", mi % 2 ? "bottom" : "top");
            if (ri < last && m.state === "done") classes.push("won");
            if (ri > 0) {
                classes.push("in");
                const feeders = [t.rounds[ri - 1][mi * 2], t.rounds[ri - 1][mi * 2 + 1]];
                if (feeders.some((f) => f && f.state === "done")) classes.push("fed");
            }
            const isSelected = selected && selected.r === ri && selected.m === mi;
            return `<div class="${classes.join(" ")}">
                <button type="button" class="match ${m.state} ${isSelected ? "selected" : ""}" data-r="${ri}" data-m="${mi}">
                    ${teamRow(m.a, m.sa, m)}
                    ${teamRow(m.b, m.sb, m)}
                </button>
            </div>`;
        }).join("");
        return `<div class="round"><p class="round-name">${roundName(ri, t.rounds.length)}</p><div class="round-body" style="--rows: ${rows}">${matches}</div></div>`;
    }).join("");

    const champion = t.champion ? `<div class="champion">${trophy}<div><span>${tr("bracket.champion")}</span><b>${esc(TEAMS[t.champion])}</b></div></div>` : "";
    bracket.innerHTML = `<div class="rounds">${rounds}</div>${champion}`;
};

const panelFor = (m, ri, mi) => {
    const t = current;
    const win = winnerOf(m);
    const team = (code, score) => code
        ? `<div class="panel-team ${win === code ? "win" : ""}"><span class="team-tag">${esc(code)}</span>${esc(TEAMS[code])}<b>${score ?? "-"}</b></div>`
        : `<div class="panel-team"><span class="team-tag">?</span>${m.bye ? tx("bracket.bye") : tx("common.toBeConfirmed")}<b>-</b></div>`;
    const texts = {
        done: tx("match.completedHelp"),
        pending: tx("match.pendingHelp"),
        scheduled: tx("match.scheduledHelp"),
        ready: tx("match.readyHelp"),
    };
    const action = m.state === "pending" ? `<button type="button" class="btn btn-full btn-glow" data-paste>${tr("match.paste")}</button>` : "";

    return `<p class="panel-label">${tr("match.heading", { round: roundName(ri, t.rounds.length), number: I18N.formatNumber(mi + 1) })}</p>
        <h4>${esc(m.a ? TEAMS[m.a] : "?")} ${tr("common.versus")} ${esc(m.b ? TEAMS[m.b] : "?")}</h4>
        <div class="panel-teams">${team(m.a, m.sa)}${team(m.b, m.sb)}</div>
        <ul class="panel-rows">
            <li><span>${tr("common.status")}</span>${tr(MATCH_STATE[m.state])}</li>
            <li><span>${tr("match.map")}</span>${esc(m.map || tx("common.toBeConfirmed"))}</li>
            <li><span>${tr("match.date")}</span>${dateTime(m.time)}</li>
            <li><span>${tr("common.format")}</span>${t.format}</li>
            <li><span>${tr("match.faceit")}</span>${m.faceit ? `<code>${esc(m.faceit)}</code>` : tr("match.noReference")}</li>
        </ul>
        <p class="panel-text">${m.bye ? tx("match.byeHelp") : texts[m.state]}</p>
        ${action}`;
};

const renderPanel = () => {
    const t = current;
    bPanel.classList.remove("changed");
    void bPanel.offsetWidth;
    bPanel.classList.add("changed");

    if (!t.rounds) {
        const free = t.slots - t.registered.length;
        bPanel.innerHTML = `<p class="panel-label">${t.status === "open" ? tx("tournaments.registrationOpen") : tx("bracket.drawing")}</p>
            <h4>${esc(t.name)}</h4>
            <ul class="panel-rows">
                <li><span>${tr("tournaments.available")}</span>${I18N.formatNumber(Math.max(0, free))}</li>
                <li><span>${tr("common.format")}</span>${t.format}</li>
                <li><span>${tr("common.start")}</span>${dateTime(t.start)}</li>
                <li><span>${tr("bracket.roster")}</span>${tr("bracket.rosterSize")}</li>
            </ul>
            <p class="panel-text">${tr("bracket.registrationUnavailable")}</p>
            ${signupButton()}`;
        return;
    }

    if (!selected) {
        bPanel.innerHTML = `<p class="panel-label">${tr("match.details")}</p><h4>${tr("match.select")}</h4><p class="panel-text">${tr("match.selectHelp")}</p>`;
        return;
    }

    const m = t.rounds[selected.r][selected.m];
    bPanel.innerHTML = panelFor(m, selected.r, selected.m);
};

const pickDefault = () => {
    if (!current.rounds) return null;
    for (let r = 0; r < current.rounds.length; r++) {
        const m = current.rounds[r].findIndex((x) => x.state === "pending" || x.state === "ready");
        if (m >= 0) return { r, m };
    }
    return { r: current.rounds.length - 1, m: 0 };
};

const selectTournament = (key) => {
    current = TOURNAMENTS.find((t) => t.id === key || t.name === key) || TOURNAMENTS[0];
    selected = pickDefault();
    renderTabs();
    renderInfo();
    bracket.classList.remove("switching");
    void bracket.offsetWidth;
    bracket.classList.add("switching");
    renderBracket();
    renderPanel();
};

bTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (tab) selectTournament(tab.dataset.id);
});

bracket.addEventListener("click", (e) => {
    const match = e.target.closest(".match");
    if (!match) return;
    selected = { r: Number(match.dataset.r), m: Number(match.dataset.m) };
    $$(".match", bracket).forEach((el) => el.classList.toggle("selected", el === match));
    renderPanel();
});

selectTournament(TOURNAMENTS[0].id);

const faceitForm = $("#faceit-form");
const faceitInput = $("#faceit-link");
const faceitMsg = $("#faceit-msg");
const faceitSteps = $("#faceit-steps");
const faceitButton = $("button[type=submit]", faceitForm);
const faceitPattern = /^https?:\/\/(www\.)?faceit\.com\/[a-z]{2}\/cs2\/room\/(1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/.*)?$/i;
const exampleLink = "https://www.faceit.com/en/cs2/room/1-4c7e9b12-3a5d-4f6e-8b21-9d0c3e7a5f18";

$("#faceit-example").addEventListener("click", () => {
    faceitInput.value = exampleLink;
    faceitInput.focus();
});

bPanel.addEventListener("click", (e) => {
    if (!e.target.closest("[data-paste]")) return;
    faceitForm.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => faceitInput.focus(), 500);
});

const showFaceit = (key, type, values = {}) => {
    I18N.bind(faceitMsg, key, values, true);
    faceitMsg.className = `faceit-msg ${type}`;
    if (type === "err") {
        faceitForm.classList.remove("shake");
        void faceitForm.offsetWidth;
        faceitForm.classList.add("shake");
    }
};

const usedIds = () => TOURNAMENTS.flatMap((t) => (t.rounds || []).flat()).map((m) => m.faceit).filter(Boolean);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pendingSpot = () => {
    for (const t of TOURNAMENTS) {
        for (let r = 0; r < (t.rounds || []).length; r++) {
            const m = t.rounds[r].findIndex((x) => x.state === "pending" && x.a && x.b);
            if (m >= 0) return { t, r, m };
        }
    }
    return null;
};

faceitForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    faceitSteps.innerHTML = "";
    const value = faceitInput.value.trim();
    const found = value.match(faceitPattern);

    if (!value) return showFaceit("faceit.required", "err");
    if (!found) return showFaceit("faceit.invalid", "err");

    const id = found[2].toLowerCase();
    if (usedIds().includes(id)) return showFaceit("faceit.duplicate", "err");

    const spot = pendingSpot();
    if (!spot) return showFaceit("faceit.noPending", "err");

    showFaceit("", "");
    faceitButton.disabled = true;
    if (current !== spot.t) selectTournament(spot.t.id);
    selected = { r: spot.r, m: spot.m };
    renderBracket();
    renderPanel();

    const list = [
        "faceit.stepLink",
        "faceit.stepFetch",
        "faceit.stepRoster",
        "faceit.stepPlayers",
        "faceit.stepAdvance",
    ];

    for (const text of list) {
        const li = document.createElement("li");
        const label = document.createElement("span");
        I18N.bind(label, text);
        li.append(label);
        if (text === list[0]) {
            const code = document.createElement("code");
            code.textContent = id;
            li.append(code);
        }
        faceitSteps.append(li);
        await wait(reducedMotion ? 50 : 650);
        li.classList.add("ok");
    }

    const played = spot.t.rounds[spot.r][spot.m];
    Object.assign(played, { sa: 10, sb: 13, state: "done", faceit: id });
    const winner = winnerOf(played);
    const next = spot.t.rounds[spot.r + 1]?.[Math.floor(spot.m / 2)];
    if (next) {
        next[spot.m % 2 ? "b" : "a"] = winner;
        if (next.a && next.b) next.state = "ready";
        selected = { r: spot.r + 1, m: Math.floor(spot.m / 2) };
    }
    renderInfo();
    renderBracket();
    renderPanel();
    renderRanking();

    const flashed = $(`.round:nth-child(${spot.r + 2}) [data-team="${winner}"]`, bracket);
    if (flashed) flashed.classList.add("flash");

    showFaceit("faceit.result", "ok", { team: TEAMS[winner] });
    faceitButton.disabled = false;
});

const modal = $("#modal");
const modalNote = $("#modal-note");
const modalTabs = $$(".modal-tab", modal);
const forms = $$(".modal-form", modal);

const TITLES = {
    login: "auth.titleLogin",
    register: "auth.titleRegister",
    reset: "auth.titleReset",
    newpass: "field.newPassword",
    account: "auth.titleAccount",
    ad: "auth.titleAd",
};

const setModalTab = (name) => {
    modalTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
    forms.forEach((form) => {
        form.hidden = form.dataset.form !== name;
        $(".form-msg", form).textContent = "";
        delete $(".form-msg", form).dataset.i18nHtml;
        $(".form-msg", form).className = "form-msg";
    });
    $(".modal-tabs", modal).hidden = ["account", "newpass", "ad"].includes(name);
    I18N.bind($("#modal-title"), TITLES[name]);
};

$$("[data-tab-go]", modal).forEach((btn) => btn.addEventListener("click", () => {
    setModalTab(btn.dataset.tabGo);
    $(`[data-form="${btn.dataset.tabGo}"] input`, modal)?.focus();
}));

const validEmail = (email) => {
    if (email.length > 254 || /\s/.test(email)) return false;
    const at = email.indexOf("@");
    const dot = email.indexOf(".", at + 2);
    return at > 0 && at === email.lastIndexOf("@") && dot > at + 1 && dot < email.length - 1;
};

let currentUser = null;

const openModal = (name, note, values = {}) => {
    if (currentUser && (name === "login" || name === "register")) {
        name = "account";
        note = note || "";
    }
    if (!currentUser && name === "ad") {
        name = "login";
        note = "auth.adSignIn";
    }
    if (name === "ad") prepareAdForm();
    setModalTab(name);
    modalNote.hidden = !note;
    if (I18N.has(note)) I18N.bind(modalNote, note, values);
    else {
        delete modalNote.dataset.i18n;
        modalNote.textContent = note || "";
    }
    modal.hidden = false;
    document.body.classList.add("locked");
    setTimeout(() => $(`[data-form="${name}"] input`, modal)?.focus(), 50);
};

const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("locked");
};

document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-modal]");
    if (trigger) {
        const noteKey = trigger.dataset.i18nAttr?.split(";").find((pair) => pair.startsWith("data-note:"))?.split(":")[1];
        openModal(trigger.dataset.modal, noteKey || trigger.dataset.note, JSON.parse(trigger.dataset.i18nParams || "{}"));
    }
    if (e.target.closest("[data-close]")) closeModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
});

modalTabs.forEach((tab) => tab.addEventListener("click", () => setModalTab(tab.dataset.tab)));

const formMessage = (form, html, type) => {
    const msg = $(".form-msg", form);
    if (I18N.has(html)) I18N.bind(msg, html, {}, true);
    else {
        delete msg.dataset.i18nHtml;
        msg.innerHTML = html;
    }
    msg.className = `form-msg ${type}`;
};

const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
    const options = { method, headers: { "Accept-Language": I18N.locale, "X-CGP-Language": I18N.language, "X-CGP-Region": I18N.region } };
    if (body !== undefined) {
        options.headers["content-type"] = "application/json";
        options.body = JSON.stringify(body);
    }
    let res;
    try {
        res = await fetch(`/api${path}`, options);
    } catch {
        throw Object.assign(new Error(tx("common.serverUnavailable")), { data: { errorKey: "common.serverUnavailable" } });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        if (!data.errorKey) data.errorKey = "common.serverUnavailable";
        throw Object.assign(new Error(tx(data.errorKey, data.values)), { data });
    }
    return data;
};

const backend = location.protocol.startsWith("http")
    ? api("/health").then(() => true).catch(() => false)
    : Promise.resolve(false);
backend.then((available) => { $("#service-status").hidden = available; });

const send = async (form, path, body, demoText) => {
    if (!(await backend)) {
        formMessage(form, demoText, "err");
        return null;
    }
    const button = $("button[type=submit]", form);
    button.disabled = true;
    try {
        return await api(path, body);
    } catch (err) {
        formMessage(form, localizedError(err), "err");
        err.handled = true;
        throw err;
    } finally {
        button.disabled = false;
    }
};

const loginButton = $(".btn-login");
const registerButton = $(".auth > .btn[data-modal=register]");
let userRequest = 0;
let loadedAds = null;
let adsRequest = 0;

const setUser = (user, broadcast = false) => {
    userRequest++;
    const changed = currentUser?.id !== user?.id;
    currentUser = user;
    if (changed) {
        adsRequest++;
        if (loadedAds) {
            loadedAds = loadedAds.map((ad) => ({ ...ad, mine: ad.author_id === user?.id }));
            paintAds(loadedAds);
        }
    }
    document.body.classList.remove("session-check");
    const label = $("span", loginButton);
    if (user) {
        delete label.dataset.i18n;
        label.textContent = user.nick;
    } else I18N.bind(label, "action.login");
    loginButton.dataset.i18nAttr = `aria-label:${user ? "account.open" : "action.login"}`;
    loginButton.dataset.i18nParams = JSON.stringify(user ? { nick: user.nick } : {});
    loginButton.setAttribute("aria-label", tx(user ? "account.open" : "action.login", user ? { nick: user.nick } : {}));
    loginButton.dataset.modal = user ? "account" : "login";
    loginButton.classList.toggle("logged", Boolean(user));
    registerButton.hidden = Boolean(user);
    $("#account-nick").textContent = user?.nick || "";
    $("#account-email").textContent = user?.email || "";
    $("#admin-btn").hidden = !user?.admin;
    $("[data-admin-open]", modal).hidden = !user?.admin;
    $("#chat-btn").hidden = !user;
    document.dispatchEvent(new CustomEvent("cgp:user"));
    if (broadcast) {
        try {
            localStorage.setItem("cgp-auth-change", `${Date.now()}:${Math.random()}`);
        } catch {}
    }
};

const toasts = $("#toasts");

const toast = (text, type = "ok", values = {}) => {
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    if (I18N.has(text)) I18N.bind(el, text, values);
    else el.textContent = text;
    toasts.append(el);
    setTimeout(() => el.classList.add("out"), 3200);
    setTimeout(() => el.remove(), 3600);
};
const toastError = (error) => toast(error.data?.errorKey || error.message, "err", error.data?.values);

const refreshUser = () => {
    const request = ++userRequest;
    return api("/auth/me").then((data) => {
        if (request === userRequest) setUser(data.user);
    }).catch(() => {
        if (request === userRequest) setUser(null);
    });
};

const reconcileSession = () => {
    document.body.classList.add("session-check");
    return refreshUser();
};

window.addEventListener("storage", (e) => {
    if (e.key !== "cgp-auth-change") return;
    setUser(null);
    reconcileSession();
});
window.addEventListener("focus", reconcileSession);
window.addEventListener("pageshow", (e) => {
    if (e.persisted) reconcileSession();
});
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reconcileSession();
});

$("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const login = form.login.value.trim();
    if (!login || !form.password.value) return formMessage(form, "auth.credentialsRequired", "err");
    if (login.includes("@") && !validEmail(login)) return formMessage(form, "auth.emailIncomplete", "err");

    try {
        const data = await send(form, "/auth/login", { login, password: form.password.value }, "auth.demoLogin");
        if (!data) return;
        setUser(data.user, true);
        formMessage(form, tr("auth.signedIn", { nick: data.user.nick }), "ok");
        form.reset();
        setTimeout(closeModal, 900);
        refreshUser();
        loadAds().catch(() => {});
    } catch (err) {
        if (err.data?.unverified) {
            formMessage(form, `${localizedError(err)} <button type="button" class="link-btn" data-resend="${esc(err.data.unverified)}">${tr("auth.resend")}</button>`, "err");
        }
    }
});

modal.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-resend]");
    if (!btn) return;
    btn.disabled = true;
    try {
        const data = await api("/auth/resend", { email: btn.dataset.resend });
        formMessage($("#form-login"), localizedResponse(data), "ok");
    } catch (err) {
        formMessage($("#form-login"), localizedError(err), "err");
        btn.disabled = false;
    }
});

$("#form-register").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const nick = form.nick.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (nick.length < 3 || nick.length > 32) return formMessage(form, "auth.nickLength", "err");
    if (!/^[\p{L}\p{N}_.-]+$/u.test(nick)) return formMessage(form, "auth.nickCharacters", "err");
    if (!validEmail(email)) return formMessage(form, "auth.emailExample", "err");
    if (password.length < 8) return formMessage(form, "auth.passwordLength", "err");
    if (password !== form.password2.value) return formMessage(form, "auth.passwordMismatch", "err");

    const data = await send(form, "/auth/register", { nick, email, password }, "auth.demoRegister").catch(() => null);
    if (!data) return;
    formMessage(form, localizedResponse(data), "ok");
    form.reset();
});

$("#form-reset").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value.trim();
    if (!validEmail(email)) return formMessage(form, "auth.emailInvalid", "err");

    const data = await send(form, "/auth/forgot", { email }, "auth.demoReset").catch(() => null);
    if (data) formMessage(form, localizedResponse(data), "ok");
});

let resetToken = null;

$("#form-newpass").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const password = form.password.value;
    if (password.length < 8) return formMessage(form, "auth.passwordLength", "err");
    if (password !== form.password2.value) return formMessage(form, "auth.passwordMismatch", "err");

    const data = await send(form, "/auth/reset", { token: resetToken, password }, "auth.demoNewPassword").catch(() => null);
    if (!data) return;
    formMessage(form, localizedResponse(data), "ok");
    form.reset();
    setTimeout(() => setModalTab("login"), 1500);
});

$("#form-account").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/auth/logout", {}).catch(() => {});
    setUser(null, true);
    closeModal();
    toast("auth.signedOut");
    loadAds().catch(() => {});
});

const adForm = $("#form-ad");

const prepareAdForm = () => {
    const team = currentUser?.team;
    const lfm = $("input[value=lfm]", adForm);
    lfm.disabled = !team;
    if (!team) $("input[value=lfc]", adForm).checked = true;
    I18N.bind($("#ad-hint"), team ? "ads.captainHint" : "ads.playerHint", team ? { team: team.name } : {});
};

adForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = adForm.elements;
    const body = {
        type: f.type.value,
        role: f.role.value,
        level: Number(f.level.value),
        availability: f.availability.value.trim(),
        description: f.description.value.trim(),
    };
    if (body.description.length < 10) return formMessage(adForm, "ads.descriptionShort", "err");

    const data = await send(adForm, "/ads", body, "ads.demoPublish").catch(() => null);
    if (!data) return;
    adForm.reset();
    closeModal();
    await loadAds().catch(() => {});
    toast("ads.published");
    $("#lfg").scrollIntoView({ behavior: "smooth" });
});

const ROLES = { entry: "role.entry", support: "role.support", awp: "role.awp", igl: "role.igl", flex: "role.flex" };

const ago = (date) => {
    const hours = Math.max(1, Math.round((Date.now() - new Date(date)) / 3600000));
    if (hours < 24) return I18N.formatRelative(-hours, "hour");
    const days = Math.round(hours / 24);
    return I18N.formatRelative(-days, "day");
};

const timeTags = (text) => Object.entries({ evenings: /wiecz|evening/i, weekends: /weekend/i, nights: /noce|noc|night/i }).filter(([, pattern]) => pattern.test(text || "")).map(([key]) => key);
const levelClass = (lvl) => (lvl >= 8 ? "lvl-high" : lvl >= 4 ? "lvl-mid" : "");
const capital = (text) => (text ? text[0].toUpperCase() + text.slice(1) : "");

const adCard = (ad) => {
    const team = ad.type === "lfm";
    const who = team ? ad.team_name : ad.nick;
    return `<article class="ad reveal" data-role="${esc(ad.role)}" data-level="${ad.faceit_level || 1}" data-time="${timeTags(ad.availability).join(" ")}">
        <div class="ad-top">
            <span class="badge ${team ? "badge-lfm" : "badge-lfc"}">${team ? tx("ads.lookingPlayer") : tx("ads.lookingTeam")}</span>
            <span class="time">${ago(ad.created_at)}</span>
        </div>
        <div class="ad-who">
            <span class="avatar ${team ? "" : "avatar-player"}">${esc(team ? ad.team_tag : ad.nick[0])}</span>
            <div>
                <h3>${esc(who)}</h3>
                <p class="ad-sub">${team ? tr("ads.captainRoster", { captain: ad.captain, members: I18N.formatNumber(ad.members) }) : esc(ad.faceit_nick || tx("ads.noFaceit"))}</p>
            </div>
        </div>
        <p class="ad-text">${esc(ad.description)}</p>
        <ul class="chips">
            <li>${tr(ROLES[ad.role] || "role.any")}</li>
            ${ad.faceit_level ? `<li><span class="lvl ${levelClass(ad.faceit_level)}">${ad.faceit_level}${team ? "+" : ""}</span>FACEIT</li>` : ""}
            ${ad.availability ? `<li>${esc(capital(ad.availability))}</li>` : ""}
        </ul>
        ${ad.mine
            ? `<button type="button" class="btn btn-full btn-ghost" data-close-ad="${ad.id}">${tr("ads.close")}</button>`
            : currentUser
                ? `<button type="button" class="btn btn-full" data-chat="${ad.author_id}">${team ? tr("ads.messageCaptain", { captain: ad.captain }) : tr("action.message")}</button>`
                : `<button type="button" class="btn btn-full" data-modal="login" data-note="${esc(tx("ads.contactSignIn", { name: who }))}" data-i18n-attr="data-note:ads.contactSignIn" data-i18n-params="${esc(JSON.stringify({ name: who }))}">${tr("action.message")}</button>`}
    </article>`;
};

const paintAds = (list) => {
    $("#ads").innerHTML = list.map(adCard).join("");
    ads = $$(".ad");
    observeReveal($("#ads"));
    applyFilters();
};
const loadAds = async () => {
    const userId = currentUser?.id;
    const request = ++adsRequest;
    const { ads: list } = await api("/ads");
    if (request !== adsRequest || userId !== currentUser?.id) return list;
    loadedAds = list;
    paintAds(list);
    return list;
};

$("#ads").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-close-ad]");
    if (!btn) return;
    if (!btn.classList.contains("confirm")) {
        btn.classList.add("confirm");
        I18N.bind(btn, "ads.confirmClose");
        setTimeout(() => {
            btn.classList.remove("confirm");
            I18N.bind(btn, "ads.close");
        }, 3000);
        return;
    }
    btn.disabled = true;
    try {
        await api(`/ads/${btn.dataset.closeAd}`, undefined, "DELETE");
        await loadAds();
        toast("ads.closed");
    } catch (err) {
        toastError(err);
        btn.disabled = false;
    }
});

const matchOrder = (time) => Date.parse(time) || 0;

const finishedMatches = () => TOURNAMENTS
    .flatMap((t) => (t.rounds || []).flat().map((m) => ({ ...m, tournament: t.name })))
    .filter((m) => m.state === "done" && m.a && m.b)
    .sort((x, y) => matchOrder(x.time) - matchOrder(y.time));

const renderRanking = () => {
    const table = Object.fromEntries(Object.keys(TEAMS).map((tag) => [tag, { tag, played: 0, wins: 0, won: 0, lost: 0, form: [], titles: 0 }]));
    const maps = {};
    const matches = finishedMatches();

    TOURNAMENTS.forEach((t) => {
        if (t.status === "done" && table[t.champion]) table[t.champion].titles++;
    });
    matches.forEach((m) => {
        maps[m.map] = (maps[m.map] || 0) + 1;
        [[m.a, m.sa, m.sb], [m.b, m.sb, m.sa]].forEach(([tag, own, opp]) => {
            const row = table[tag];
            if (!row) return;
            row.played++;
            row.won += own;
            row.lost += opp;
            row.wins += own > opp ? 1 : 0;
            row.form.push(own > opp ? "win" : "loss");
        });
    });

    const rows = Object.values(table).sort((a, b) => b.wins - a.wins || (b.won - b.lost) - (a.won - a.lost) || b.played - a.played || TEAMS[a.tag].localeCompare(TEAMS[b.tag], I18N.locale));
    $("#r-body").innerHTML = rows.map((r, i) => {
        const diff = r.won - r.lost;
        return `<tr class="${i < 3 && r.played ? `r-top r-top-${i + 1}` : ""}" style="--n: ${i}">
            <td class="r-pos">${I18N.formatNumber(i + 1)}</td>
            <td><span class="r-team"><span class="avatar">${esc(r.tag)}</span><b>${esc(TEAMS[r.tag])}</b></span></td>
            <td>${I18N.formatNumber(r.played)}</td>
            <td class="r-w">${I18N.formatNumber(r.wins)}</td>
            <td>${I18N.formatNumber(r.played - r.wins)}</td>
            <td class="${diff > 0 ? "plus" : diff < 0 ? "minus" : ""}">${r.won}:${r.lost} <small>${diff > 0 ? "+" : ""}${diff}</small></td>
            <td><span class="r-form">${r.form.slice(-5).map((f) => `<i class="f-${f}" title="${esc(tx(f === "win" ? "ranking.win" : "ranking.loss"))}" data-i18n-attr="title:${f === "win" ? "ranking.win" : "ranking.loss"}">${tr(f === "win" ? "ranking.winLetter" : "ranking.lossLetter")}</i>`).join("") || `<em>${tr("ranking.noMatches")}</em>`}</span></td>
            <td class="r-titles ${r.titles ? "won" : ""}">${r.titles ? `${trophy}${r.titles}` : "0"}</td>
        </tr>`;
    }).join("");

    const top = Math.max(1, ...Object.values(maps));
    $("#r-maps").innerHTML = Object.entries(maps).sort((a, b) => b[1] - a[1]).map(([map, n]) => `<li>
        <span>${esc(map)}</span><b>${n}</b><i style="--w: ${(n / top) * 100}%"></i>
    </li>`).join("") || `<li>${tr("ranking.noMaps")}</li>`;

    const facts = [];
    if (matches.length) {
        const blowout = matches.reduce((a, b) => (Math.abs(b.sa - b.sb) > Math.abs(a.sa - a.sb) ? b : a));
        facts.push(tr("ranking.largestWin", { teamA: TEAMS[blowout.a], teamB: TEAMS[blowout.b], scoreA: blowout.sa, scoreB: blowout.sb, map: blowout.map }));
        const overtime = matches.filter((m) => Math.max(m.sa, m.sb) > 13);
        if (overtime.length) facts.push(tr("ranking.overtime", { matches: I18N.formatList(overtime.map((m) => `${m.a} ${m.sa}:${m.sb} ${m.b}`)) }));
        const rounds = matches.reduce((sum, m) => sum + m.sa + m.sb, 0);
        facts.push(tr("ranking.totals", { matches: I18N.formatNumber(matches.length), rounds: I18N.formatNumber(rounds), average: I18N.formatNumber(rounds / matches.length, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }));
        const streak = (form) => {
            let run = 0;
            let longest = 0;
            form.forEach((result) => {
                run = result === "win" ? run + 1 : 0;
                longest = Math.max(longest, run);
            });
            return longest;
        };
        const hot = rows.filter((r) => r.wins).sort((a, b) => streak(b.form) - streak(a.form))[0];
        if (hot) facts.push(tr("ranking.streak", { team: TEAMS[hot.tag], count: I18N.formatNumber(streak(hot.form)) }));
    }
    $("#r-facts").innerHTML = facts.map((f) => `<li>${f}</li>`).join("") || `<li>${tr("ranking.noFacts")}</li>`;
};

const placesLeft = (n) => tx("tournaments.places", { count: Math.max(0, n) });

let tickerAds = [];

const renderTicker = (adList = tickerAds) => {
    tickerAds = adList;
    const team = (tag) => TEAMS[tag] || tag;
    const items = [];
    TOURNAMENTS.forEach((t) => {
        if (t.status === "live") (t.rounds || []).flat().forEach((m) => {
            if (m.state === "done") items.push(`<b>${esc(team(m.a))}</b> ${m.sa}:${m.sb} <b>${esc(team(m.b))}</b>`);
            else if (m.a && m.b && m.state === "pending") items.push(tr("ticker.matchPending", { teamA: team(m.a), teamB: team(m.b) }));
        });
        if (t.status === "open") items.push(`<b>${esc(t.name)}</b> ${placesLeft(t.slots - (t.registered || []).length)}`);
        if (t.status === "done" && t.champion) items.push(tr("ticker.champion", { team: team(t.champion), tournament: t.name }));
    });
    adList.filter((ad) => ad.type === "lfm").slice(0, 2).forEach((ad) => {
        items.push(tr("ticker.recruiting", { team: ad.team_name, role: tx(ROLES[ad.role] || "role.any"), level: I18N.formatNumber(ad.faceit_level) }));
    });
    if (!items.length) {
        $("#ticker-track").innerHTML = "";
        return;
    }
    const group = (hidden) => `<div class="ticker-group"${hidden ? ' aria-hidden="true"' : ""}><span class="ticker-live">${tr("ticker.label")}</span>${items.map((i) => `<span>${i}</span><i></i>`).join("")}</div>`;
    $("#ticker-track").innerHTML = group(false) + group(true);
};

renderRanking();
renderCards();
renderTicker();

const applyTournaments = (data) => {
    if (!data.tournaments.length) {
        I18N.bind($("#service-status"), "common.sampleTournaments");
        $("#service-status").hidden = false;
        return;
    }
    const keep = current.name;
    TEAMS = data.teams;
    TOURNAMENTS = data.tournaments;
    selectTournament(keep);
    renderRanking();
    renderCards();
    renderTicker();
    document.dispatchEvent(new CustomEvent("cgp:tournaments"));
};

const loadTournaments = () => api("/tournaments").then(applyTournaments);

const notice = $("#notice");

const setNoticeHeight = () => {
    if (!notice.hidden) notice.style.setProperty("--notice-content-height", `${$(".notice-inner", notice).offsetHeight}px`);
    document.documentElement.style.setProperty("--notice", notice.hidden ? "0px" : `${notice.offsetHeight}px`);
};

let noticeItem = null;

const showNotice = (item) => {
    if (item !== undefined) noticeItem = item;
    const canHide = Boolean(currentUser);
    let dismissed = false;
    if (canHide && noticeItem) {
        try { dismissed = localStorage.getItem("cgp-notice") === String(noticeItem.id); } catch {}
    }
    const hide = !noticeItem || dismissed;
    notice.hidden = hide;
    $("#notice-x").hidden = hide || !canHide;
    if (!hide) {
        notice.dataset.id = noticeItem.id;
        $("#notice-text").textContent = noticeItem.content;
    }
    setNoticeHeight();
};

const loadNotice = () => api("/announcement").then((data) => showNotice(data.announcement)).catch(() => {});

$("#notice-x").addEventListener("click", () => {
    if (!currentUser || !noticeItem) return;
    try { localStorage.setItem("cgp-notice", noticeItem.id); } catch {}
    notice.classList.add("out");
    setTimeout(() => {
        notice.classList.remove("out");
        showNotice(noticeItem);
    }, 300);
});

document.addEventListener("cgp:user", () => showNotice());
window.addEventListener("resize", setNoticeHeight);

const loadData = async () => {
    if (!(await backend)) return;

    const request = ++userRequest;
    const [tournaments, me] = await Promise.allSettled([api("/tournaments"), api("/auth/me")]);
    if (me.status === "fulfilled" && request === userRequest) setUser(me.value.user, new URLSearchParams(location.search).get("verified") === "1");
    if (tournaments.status === "fulfilled") applyTournaments(tournaments.value);
    loadNotice();

    const adList = await loadAds().catch(() => []);
    renderTicker(adList);

    const params = new URLSearchParams(location.search);
    if (params.has("reset")) {
        resetToken = params.get("reset");
        openModal("newpass");
    } else if (params.get("verified") === "1" && currentUser) {
        openModal("account");
        formMessage($("#form-account"), "auth.activated", "ok");
    } else if (params.get("verified") === "0") {
        openModal("login");
        formMessage($("#form-login"), "auth.activationExpired", "err");
    }
    if (params.size) history.replaceState(null, "", location.pathname + location.hash);
};

loadData();

const chicken = $("#chicken");
const chickenSay = $("#chicken-say");
const chickenScore = $("#chicken-score");
const CLUCKS = ["chicken.idle"];
const CHICKEN_LINES = {
    1: "chicken.lineOne",
    3: "chicken.lineThree",
    5: "chicken.lineFive",
    10: "chicken.lineTen",
    25: "chicken.lineTwentyFive",
};
let chickens = 0;
try { chickens = Number(localStorage.getItem("cgp-chickens")) || 0; } catch {}

const showChickens = () => {
    chickenScore.hidden = !chickens;
    I18N.bind(chickenScore, "chicken.score", { count: I18N.formatNumber(chickens) });
};

showChickens();

setInterval(() => {
    if (chicken.classList.contains("dead") || chicken.matches(":hover") || Math.random() < 0.5) return;
    I18N.bind(chickenSay, CLUCKS[Math.floor(Math.random() * CLUCKS.length)]);
    chicken.classList.add("talk");
    setTimeout(() => chicken.classList.remove("talk"), 1800);
}, 6000);

chicken.addEventListener("mouseenter", () => {
    I18N.bind(chickenSay, "chicken.idle");
});

chicken.addEventListener("click", () => {
    if (chicken.classList.contains("dead")) return;
    const r = chicken.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;

    for (let i = 0; i < 16; i++) {
        const feather = document.createElement("i");
        const angle = Math.random() * Math.PI * 2;
        const power = 40 + Math.random() * 90;
        feather.className = "feather";
        feather.style.left = `${x}px`;
        feather.style.top = `${y}px`;
        feather.style.setProperty("--dx", `${Math.cos(angle) * power}px`);
        feather.style.setProperty("--dy", `${Math.sin(angle) * power - 40}px`);
        feather.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
        document.body.append(feather);
        setTimeout(() => feather.remove(), 1400);
    }

    const plus = document.createElement("span");
    plus.className = "chicken-plus";
    I18N.bind(plus, "chicken.point");
    plus.style.left = `${x}px`;
    plus.style.top = `${y - 20}px`;
    document.body.append(plus);
    setTimeout(() => plus.remove(), 1200);

    chicken.classList.remove("talk");
    chicken.classList.add("dead");
    chickens++;
    try { localStorage.setItem("cgp-chickens", chickens); } catch {}
    showChickens();
    chickenScore.classList.remove("bump");
    void chickenScore.offsetWidth;
    chickenScore.classList.add("bump");
    if (CHICKEN_LINES[chickens]) toast(CHICKEN_LINES[chickens]);

    setTimeout(() => {
        chicken.style.animation = "none";
        void chicken.offsetWidth;
        chicken.style.animation = "";
        chicken.classList.remove("dead");
    }, 6000);
});

document.addEventListener("cgp:languagechange", () => {
    $$("[data-scramble]").forEach((element) => { element.dataset.text = tx(element.dataset.i18n); });
    const activeStep = stepButtons.findIndex((button) => button.classList.contains("active"));
    I18N.bind(screenPath, ["how.path.register", "how.path.recruitment", "how.path.chat", "how.path.results"][Math.max(0, activeStep)]);
    renderTabs();
    renderInfo();
    renderBracket();
    renderPanel();
    renderCards();
    renderRanking();
    renderTicker();
    if (loadedAds) paintAds(loadedAds);
    else applyFilters();
    if (!adForm.hidden) prepareAdForm();
    showChickens();
    moveInk();
    setNoticeHeight();
});
