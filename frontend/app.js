const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const intro = $("#intro");
const introDelay = sessionStorage.getItem("cgp-intro") || reducedMotion ? 0 : 1100;

if (introDelay) {
    document.documentElement.style.setProperty("--intro", `${introDelay / 1000}s`);
    sessionStorage.setItem("cgp-intro", "1");
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

burger.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", open);
});

$$("a", nav).forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("open");
    burger.classList.remove("open");
}));

const spyLinks = $$("[data-spy]");
const spyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        spyLinks.forEach((link) => link.classList.toggle("active", link.dataset.spy === entry.target.id));
    });
}, { rootMargin: "-45% 0px -50% 0px" });

spyLinks.forEach((link) => spyObserver.observe(document.getElementById(link.dataset.spy)));

new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) spyLinks.forEach((link) => link.classList.remove("active"));
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
        const start = performance.now();

        const tick = (now) => {
            const p = Math.min((now - start) / 1200, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    });
}, introDelay + 800);

const glyphs = "ABCDEFGHIJKLMNOPRSTUWYZ0123456789#%&*/";

const scramble = (el) => {
    if (el.dataset.busy) return;
    el.dataset.busy = "1";
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    let frame = 0;
    const total = 22;

    const step = () => {
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
    el.addEventListener("mouseenter", () => scramble(el));
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
    screenPath.textContent = stepButtons[index].dataset.path;
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

$$(".slots-grid").forEach((grid) => {
    const filled = Number(grid.dataset.filled);
    const total = Number(grid.dataset.total);
    grid.style.gridTemplateColumns = `repeat(${Math.min(total, 8)}, 1fr)`;
    grid.innerHTML = Array.from({ length: total }, (_, k) => `<i class="${k < filled ? "full" : ""}" style="--k: ${k}"></i>`).join("");
    grid.insertAdjacentHTML("afterend", `<p class="slots-label"><b>${filled}</b> / ${total} drużyn zapisanych</p>`);
});

const pad = (n) => String(n).padStart(2, "0");

const renderCountdowns = () => {
    $$(".countdown[data-deadline]").forEach((el) => {
        const diff = new Date(el.dataset.deadline) - Date.now();
        if (diff <= 0) {
            el.className = "countdown closed";
            el.textContent = "Zapisy zamknięte, drabinka się losuje.";
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor(diff / 3600000) % 24;
        const m = Math.floor(diff / 60000) % 60;
        const s = Math.floor(diff / 1000) % 60;
        el.innerHTML = `<p class="countdown-title">Zapisy zamykają się za</p>
            <div><b>${d}</b><span>dni</span></div>
            <div><b>${pad(h)}</b><span>godz.</span></div>
            <div><b>${pad(m)}</b><span>min</span></div>
            <div><b>${pad(s)}</b><span>sek</span></div>`;
    });
};

renderCountdowns();
setInterval(renderCountdowns, 1000);

const tCards = $$(".t-card");
const tTabs = $$("#t-tabs .tab");

tTabs.forEach((tab) => {
    const filter = tab.dataset.filter;
    $("span", tab).textContent = filter === "all" ? tCards.length : tCards.filter((c) => c.dataset.status === filter).length;
    tab.addEventListener("click", () => {
        tTabs.forEach((t) => t.classList.toggle("active", t === tab));
        tCards.forEach((card) => card.classList.toggle("hidden", filter !== "all" && card.dataset.status !== filter));
    });
});

if (canAim) {
    tCards.forEach((card) => {
        card.addEventListener("pointermove", (e) => {
            const r = card.getBoundingClientRect();
            card.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 6}deg`);
            card.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -6}deg`);
        });
        card.addEventListener("pointerleave", () => {
            card.style.setProperty("--rx", "0deg");
            card.style.setProperty("--ry", "0deg");
        });
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

    $("#ads-count").innerHTML = `Ogłoszenia: <b>${shown}</b>`;
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
        start: "24.10, 18:00",
        slots: 8,
        teams: 4,
        rounds: [
            [
                { ...done("AKD", "CBS", 13, 8, "Mirage", "24.10, 18:00"), faceit: "1-8f3c2a71-4b6e-4d2a-9c11-2e7f5d9a0b43" },
                { a: "NCM", b: "SGM", map: "Inferno", time: "24.10, 19:30", state: "pending" },
            ],
            [
                { a: "AKD", b: null, map: "Do wyboru", time: "27.10, 20:00", state: "scheduled" },
            ],
        ],
    },
    {
        id: "sesja",
        name: "Sesja Cup",
        status: "open",
        format: "BO1",
        start: "08.11, 18:00",
        slots: 8,
        registered: ["AKD", "PLS", "BYW", "KIK", "SES"],
        deadline: "2026-11-07T18:00:00+01:00",
    },
    {
        id: "nocny",
        name: "Nocny Turniej BO3",
        status: "open",
        format: "BO3",
        start: "15.11, 18:00",
        slots: 16,
        registered: ["NCM"],
        deadline: "2026-11-14T18:00:00+01:00",
    },
    {
        id: "otwarcie",
        name: "Turniej Otwarcia",
        status: "done",
        format: "BO1",
        start: "17.10, 17:00",
        slots: 8,
        teams: 8,
        champion: "SGM",
        rounds: [
            [
                done("SGM", "KIK", 13, 4, "Mirage", "17.10, 17:00"),
                done("NCM", "BYW", 11, 13, "Nuke", "17.10, 17:00"),
                done("AKD", "SES", 13, 9, "Ancient", "17.10, 18:15"),
                done("CBS", "PLS", 16, 14, "Inferno", "17.10, 18:15"),
            ],
            [
                done("SGM", "BYW", 13, 7, "Anubis", "17.10, 19:30"),
                done("AKD", "CBS", 10, 13, "Dust2", "17.10, 19:30"),
            ],
            [
                done("SGM", "CBS", 13, 11, "Mirage", "17.10, 21:00"),
            ],
        ],
    },
];

const STATUS = {
    live: { label: "W trakcie", dot: "dot-live", badge: "badge-live" },
    open: { label: "Zapisy", dot: "dot-open", badge: "badge-open" },
    done: { label: "Zakończony", dot: "dot-done", badge: "badge-done" },
};

const MATCH_STATE = {
    done: "Zakończony",
    pending: "Czeka na wynik",
    scheduled: "Zaplanowany",
    ready: "Gotowy do gry",
};

const trophy = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v3h3v2a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.6 13 5 5 0 0 1 4 8V6h3V3zm-1 5c0 1.2.8 2.3 2 2.7V8H6zm12 0h-2v2.7c1.2-.4 2-1.5 2-2.7z" /></svg>`;

const bTabs = $("#b-tabs");
const bInfo = $("#b-info");
const bracket = $("#bracket");
const bPanel = $("#b-panel");
let current = TOURNAMENTS[0];
let selected = null;

const roundName = (i, total) => ["Finał", "Półfinały", "Ćwierćfinały"][total - i - 1] || `Runda ${i + 1}`;
const winnerOf = (m) => (m.state === "done" ? (m.sa > m.sb ? m.a : m.b) : null);

const teamRow = (code, score, m) => {
    if (!code) return `<div class="team tbd"><span class="team-tag">?</span><span class="team-name">Do ustalenia</span><b>-</b></div>`;
    const win = winnerOf(m);
    const cls = win ? (win === code ? "win" : "lose") : "";
    return `<div class="team ${cls}" data-team="${code}"><span class="team-tag">${code}</span><span class="team-name">${TEAMS[code]}</span><b>${score ?? "-"}</b></div>`;
};

const renderTabs = () => {
    bTabs.innerHTML = TOURNAMENTS.map((t) => `<button type="button" class="tab ${t === current ? "active" : ""}" data-id="${t.id}"><i class="dot ${STATUS[t.status].dot}"></i>${t.name}</button>`).join("");
};

const renderInfo = () => {
    const t = current;
    const count = t.registered ? t.registered.length : t.teams;
    bInfo.innerHTML = `<h3>${t.name}</h3>
        <span class="badge ${STATUS[t.status].badge}">${STATUS[t.status].label}</span>
        <span>Format <b>${t.format}</b></span>
        <span>Start <b>${t.start}</b></span>
        <span>Drużyny <b>${count} / ${t.slots}</b></span>`;
};

const renderBracket = () => {
    const t = current;

    if (!t.rounds) {
        const slots = Array.from({ length: t.slots }, (_, i) => {
            const code = t.registered[i];
            return code ? `<div><span class="team-tag">${code}</span>${TEAMS[code]}</div>` : `<div class="empty-slot">Wolne miejsce</div>`;
        }).join("");
        bracket.innerHTML = `<div class="signup">
            <p>Drabinka wylosuje się sama, gdy zamkną się zapisy. Do tego czasu widać tu drużyny, które już są zapisane.</p>
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

    const champion = t.champion ? `<div class="champion">${trophy}<div><span>Mistrz turnieju</span><b>${TEAMS[t.champion]}</b></div></div>` : "";
    bracket.innerHTML = `<div class="rounds">${rounds}</div>${champion}`;
};

const panelFor = (m, ri, mi) => {
    const t = current;
    const win = winnerOf(m);
    const team = (code, score) => code
        ? `<div class="panel-team ${win === code ? "win" : ""}"><span class="team-tag">${code}</span>${TEAMS[code]}<b>${score ?? "-"}</b></div>`
        : `<div class="panel-team"><span class="team-tag">?</span>Do ustalenia<b>-</b></div>`;
    const texts = {
        done: "Wynik pobrany automatycznie z FACEIT. Gracze w meczu zgadzali się ze składami zapisanymi na turniej.",
        pending: "Mecz się toczy albo czeka na link. Po meczu kapitan wkleja link do pokoju z FACEIT i wynik wpisuje się sam.",
        scheduled: "Czeka na zwycięzcę drugiego meczu z poprzedniej rundy.",
        ready: "Obie drużyny są znane, można grać. Po meczu kapitan wkleja link z FACEIT.",
    };
    const action = m.state === "pending" ? `<button type="button" class="btn btn-full btn-glow" data-paste>Wklej link do tego meczu</button>` : "";

    return `<p class="panel-label">${roundName(ri, t.rounds.length)} | mecz ${mi + 1}</p>
        <h4>${m.a ? TEAMS[m.a] : "?"} vs ${m.b ? TEAMS[m.b] : "?"}</h4>
        <div class="panel-teams">${team(m.a, m.sa)}${team(m.b, m.sb)}</div>
        <ul class="panel-rows">
            <li><span>Status</span>${MATCH_STATE[m.state]}</li>
            <li><span>Mapa</span>${m.map}</li>
            <li><span>Termin</span>${m.time}</li>
            <li><span>Format</span>${t.format}</li>
            <li><span>Mecz FACEIT</span>${m.faceit ? `<code>${m.faceit}</code>` : "jeszcze brak"}</li>
        </ul>
        <p class="panel-text">${texts[m.state]}</p>
        ${action}`;
};

const renderPanel = () => {
    const t = current;
    bPanel.classList.remove("changed");
    void bPanel.offsetWidth;
    bPanel.classList.add("changed");

    if (!t.rounds) {
        const free = t.slots - t.registered.length;
        bPanel.innerHTML = `<p class="panel-label">Zapisy otwarte</p>
            <h4>${t.name}</h4>
            <ul class="panel-rows">
                <li><span>Wolne miejsca</span>${free}</li>
                <li><span>Format</span>${t.format}</li>
                <li><span>Start</span>${t.start}</li>
                <li><span>Skład</span>5 graczy + do 2 rezerwowych</li>
            </ul>
            <p class="panel-text">Kapitan zapisuje całą drużynę. Strona sprawdza, czy jest 5 graczy i czy nikt nie gra w dwóch ekipach naraz.</p>
            <button type="button" class="btn btn-full btn-glow" data-modal="register" data-note="Żeby zapisać drużynę, załóż konto albo się zaloguj.">Zapisz drużynę</button>`;
        return;
    }

    if (!selected) {
        bPanel.innerHTML = `<p class="panel-label">Szczegóły meczu</p><h4>Kliknij mecz</h4><p class="panel-text">Wybierz dowolny mecz w drabince, a tutaj pokaże się wynik, mapa, termin i ID meczu z FACEIT.</p>`;
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

$$("[data-show-bracket]").forEach((btn) => btn.addEventListener("click", () => {
    selectTournament(btn.dataset.showBracket);
    $("#drabinka").scrollIntoView({ behavior: "smooth" });
}));

selectTournament(TOURNAMENTS[0].id);

const faceitForm = $("#faceit-form");
const faceitInput = $("#faceit-link");
const faceitMsg = $("#faceit-msg");
const faceitSteps = $("#faceit-steps");
const faceitButton = $("button[type=submit]", faceitForm);
const faceitPattern = /^https?:\/\/(www\.)?faceit\.com\/[a-z]{2}\/cs2\/room\/(1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/.*)?$/i;
const exampleLink = "https://www.faceit.com/pl/cs2/room/1-4c7e9b12-3a5d-4f6e-8b21-9d0c3e7a5f18";

$("#faceit-example").addEventListener("click", () => {
    faceitInput.value = exampleLink;
    faceitInput.focus();
});

bPanel.addEventListener("click", (e) => {
    if (!e.target.closest("[data-paste]")) return;
    faceitForm.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => faceitInput.focus(), 500);
});

const showFaceit = (html, type) => {
    faceitMsg.innerHTML = html;
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

    if (!value) return showFaceit("Najpierw wklej link do pokoju meczowego.", "err");
    if (!found) return showFaceit("To nie wygląda na link do meczu CS2 na FACEIT. Powinien wyglądać tak: <code>faceit.com/pl/cs2/room/1-...</code>", "err");

    const id = found[2].toLowerCase();
    if (usedIds().includes(id)) return showFaceit("Ten link był już użyty przy innym meczu. Jeden mecz z FACEIT liczy się tylko raz.", "err");

    const spot = pendingSpot();
    if (!spot) return showFaceit("Żaden turniej nie ma teraz meczu, który czeka na wynik. Odśwież stronę, żeby zacząć demo od nowa.", "err");

    showFaceit("", "");
    faceitButton.disabled = true;
    if (current !== spot.t) selectTournament(spot.t.id);
    selected = { r: spot.r, m: spot.m };
    renderBracket();
    renderPanel();

    const list = [
        `Link poprawny, ID meczu: <code>${id}</code>`,
        "Pobieram mecz z FACEIT",
        "Mecz zakończony, porównuję graczy ze składami",
        "10 na 10 graczy się zgadza",
        "Zapisuję wynik i przesuwam drabinkę",
    ];

    for (const text of list) {
        const li = document.createElement("li");
        li.innerHTML = text;
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

    const flashed = $(`.round:nth-child(${spot.r + 2}) [data-team="${winner}"]`, bracket);
    if (flashed) flashed.classList.add("flash");

    showFaceit(`Gotowe. <b>${TEAMS[winner]}</b> wygrywa 13:10${next ? " i idzie dalej" : ""}. To tryb demo, wynik nie zapisuje się w bazie. Prawdziwy przyjdzie z FACEIT API.`, "ok");
    faceitButton.disabled = false;
});

const modal = $("#modal");
const modalNote = $("#modal-note");
const modalTabs = $$(".modal-tab", modal);
const forms = $$(".modal-form", modal);

const TITLES = {
    login: "Witaj z powrotem",
    register: "Dołącz do CGP",
    reset: "Zapomniane hasło",
    newpass: "Nowe hasło",
    account: "Twoje konto",
};

const setModalTab = (name) => {
    modalTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
    forms.forEach((form) => {
        form.hidden = form.dataset.form !== name;
        $(".form-msg", form).textContent = "";
        $(".form-msg", form).className = "form-msg";
    });
    $(".modal-tabs", modal).hidden = name === "account" || name === "newpass";
    $("#modal-title").textContent = TITLES[name];
};

$$("[data-tab-go]", modal).forEach((btn) => btn.addEventListener("click", () => {
    setModalTab(btn.dataset.tabGo);
    $(`[data-form="${btn.dataset.tabGo}"] input`, modal)?.focus();
}));

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

let currentUser = null;

const openModal = (name, note) => {
    if (currentUser && (name === "login" || name === "register")) {
        name = "account";
        note = note ? "Jesteś zalogowany. Ta funkcja wejdzie w kolejnym etapie projektu." : "";
    }
    setModalTab(name);
    modalNote.hidden = !note;
    modalNote.textContent = note || "";
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
    if (trigger) openModal(trigger.dataset.modal, trigger.dataset.note);
    if (e.target.closest("[data-close]")) closeModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
});

modalTabs.forEach((tab) => tab.addEventListener("click", () => setModalTab(tab.dataset.tab)));

const formMessage = (form, html, type) => {
    const msg = $(".form-msg", form);
    msg.innerHTML = html;
    msg.className = `form-msg ${type}`;
};

const api = async (path, body) => {
    const options = body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
    const res = await fetch(`/api${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Serwer nie odpowiada. Spróbuj za chwilę."), { data });
    return data;
};

const backend = location.protocol.startsWith("http")
    ? api("/health").then(() => true).catch(() => false)
    : Promise.resolve(false);

const send = async (form, path, body, demoText) => {
    if (!(await backend)) {
        formMessage(form, `Tryb demo: ${demoText}`, "ok");
        return null;
    }
    const button = $("button[type=submit]", form);
    button.disabled = true;
    try {
        return await api(path, body);
    } catch (err) {
        formMessage(form, esc(err.message), "err");
        err.handled = true;
        throw err;
    } finally {
        button.disabled = false;
    }
};

const loginButton = $(".btn-login");
const registerButton = $(".auth > .btn[data-modal=register]");

const setUser = (user) => {
    currentUser = user;
    $("span", loginButton).textContent = user ? user.nick : "Zaloguj";
    loginButton.dataset.modal = user ? "account" : "login";
    loginButton.classList.toggle("logged", Boolean(user));
    registerButton.hidden = Boolean(user);
    $("#account-nick").textContent = user?.nick || "";
    $("#account-email").textContent = user?.email || "";
};

$("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const login = form.login.value.trim();
    if (!login || !form.password.value) return formMessage(form, "Wpisz nick albo e-mail i hasło.", "err");
    if (login.includes("@") && !emailPattern.test(login)) return formMessage(form, "Ten e-mail wygląda na niepełny.", "err");

    try {
        const data = await send(form, "/auth/login", { login, password: form.password.value }, `logowanie działa po wejściu na stronę online. Cześć, <b>${esc(login)}</b>!`);
        if (!data) return;
        setUser(data.user);
        formMessage(form, `Cześć <b>${esc(data.user.nick)}</b>, jesteś zalogowany.`, "ok");
        form.reset();
        setTimeout(closeModal, 900);
    } catch (err) {
        if (err.data?.unverified) {
            formMessage(form, `${esc(err.message)} <button type="button" class="link-btn" data-resend="${esc(err.data.unverified)}">Wyślij link ponownie</button>`, "err");
        }
    }
});

modal.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-resend]");
    if (!btn) return;
    btn.disabled = true;
    const data = await api("/auth/resend", { email: btn.dataset.resend }).catch((err) => ({ message: err.message }));
    formMessage($("#form-login"), esc(data.message), "ok");
});

$("#form-register").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const nick = form.nick.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (nick.length < 3 || nick.length > 32) return formMessage(form, "Nick musi mieć od 3 do 32 znaków.", "err");
    if (!/^[\p{L}\p{N}_.-]+$/u.test(nick)) return formMessage(form, "Nick może mieć tylko litery, cyfry oraz znaki _ . -", "err");
    if (!emailPattern.test(email) || email.length > 254) return formMessage(form, "Podaj poprawny e-mail, np. kuba@example.com", "err");
    if (password.length < 8) return formMessage(form, "Hasło musi mieć co najmniej 8 znaków.", "err");
    if (password !== form.password2.value) return formMessage(form, "Hasła się różnią.", "err");

    const data = await send(form, "/auth/register", { nick, email, password }, `na stronie online na <b>${esc(email)}</b> przyjdzie link aktywacyjny.`).catch(() => null);
    if (!data) return;
    formMessage(form, esc(data.message), "ok");
    form.reset();
});

$("#form-reset").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value.trim();
    if (!emailPattern.test(email)) return formMessage(form, "Podaj poprawny e-mail.", "err");

    const data = await send(form, "/auth/forgot", { email }, `na stronie online link do zmiany hasła przyjdzie na <b>${esc(email)}</b>.`).catch(() => null);
    if (data) formMessage(form, esc(data.message), "ok");
});

let resetToken = null;

$("#form-newpass").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const password = form.password.value;
    if (password.length < 8) return formMessage(form, "Hasło musi mieć co najmniej 8 znaków.", "err");
    if (password !== form.password2.value) return formMessage(form, "Hasła się różnią.", "err");

    const data = await send(form, "/auth/reset", { token: resetToken, password }, "hasło zmienia się na stronie online.").catch(() => null);
    if (!data) return;
    formMessage(form, esc(data.message), "ok");
    form.reset();
    setTimeout(() => setModalTab("login"), 1500);
});

$("#form-account").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/auth/logout", {}).catch(() => {});
    setUser(null);
    closeModal();
});

const ROLES = { entry: "Entry", support: "Support", awp: "AWP", igl: "IGL", flex: "Flex" };

const ago = (date) => {
    const hours = Math.max(1, Math.round((Date.now() - new Date(date)) / 3600000));
    if (hours < 24) return `${hours} godz. temu`;
    const days = Math.round(hours / 24);
    return days === 1 ? "1 dzień temu" : `${days} dni temu`;
};

const timeTags = (text) => ["wieczory", "weekendy", "noce"].filter((key) => (text || "").toLowerCase().includes(key.slice(0, 4)));
const levelClass = (lvl) => (lvl >= 8 ? "lvl-high" : lvl >= 4 ? "lvl-mid" : "");
const capital = (text) => (text ? text[0].toUpperCase() + text.slice(1) : "");

const adCard = (ad) => {
    const team = ad.type === "lfm";
    const who = team ? ad.team_name : ad.nick;
    return `<article class="ad reveal" data-role="${esc(ad.role)}" data-level="${ad.faceit_level || 1}" data-time="${timeTags(ad.availability).join(" ")}">
        <div class="ad-top">
            <span class="badge ${team ? "badge-lfm" : "badge-lfc"}">${team ? "Szuka gracza" : "Szuka drużyny"}</span>
            <span class="time">${ago(ad.created_at)}</span>
        </div>
        <div class="ad-who">
            <span class="avatar ${team ? "" : "avatar-player"}">${esc(team ? ad.team_tag : ad.nick[0])}</span>
            <div>
                <h3>${esc(who)}</h3>
                <p class="ad-sub">${team ? `kapitan ${esc(ad.captain)}, skład ${ad.members} / 5` : esc(ad.faceit_nick || "bez konta FACEIT")}</p>
            </div>
        </div>
        <p class="ad-text">${esc(ad.description)}</p>
        <ul class="chips">
            <li>${ROLES[ad.role] || "Dowolna rola"}</li>
            ${ad.faceit_level ? `<li><span class="lvl ${levelClass(ad.faceit_level)}">${ad.faceit_level}${team ? "+" : ""}</span>FACEIT</li>` : ""}
            ${ad.availability ? `<li>${esc(capital(ad.availability))}</li>` : ""}
        </ul>
        <button type="button" class="btn btn-full" data-modal="login" data-note="Zaloguj się, żeby napisać do: ${esc(who)}.">Napisz</button>
    </article>`;
};

const loadData = async () => {
    if (!(await backend)) return;

    const [tournaments, adList, me] = await Promise.allSettled([api("/tournaments"), api("/ads"), api("/auth/me")]);

    if (tournaments.status === "fulfilled" && tournaments.value.tournaments.length) {
        const keep = current.name;
        TEAMS = tournaments.value.teams;
        TOURNAMENTS = tournaments.value.tournaments;
        selectTournament(keep);
    }

    if (adList.status === "fulfilled") {
        $("#ads").innerHTML = adList.value.ads.map(adCard).join("");
        ads = $$(".ad");
        observeReveal($("#ads"));
        applyFilters();
    }

    if (me.status === "fulfilled") setUser(me.value.user);

    const params = new URLSearchParams(location.search);
    if (params.has("reset")) {
        resetToken = params.get("reset");
        openModal("newpass");
    } else if (params.get("verified") === "1" && currentUser) {
        openModal("account");
        formMessage($("#form-account"), "Mail potwierdzony, konto jest aktywne. Witaj w CGP!", "ok");
    } else if (params.get("verified") === "0") {
        openModal("login");
        formMessage($("#form-login"), "Ten link aktywacyjny wygasł albo był już użyty. Zaloguj się, a wyślemy nowy.", "err");
    }
    if (params.size) history.replaceState(null, "", location.pathname + location.hash);
};

loadData();
