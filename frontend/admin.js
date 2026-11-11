const adminBox = $("#admin");
const adminMain = $("#admin-main");
const adminNav = $("#admin-nav");
const adminReports = $("#admin-reports");

let adminView = "stats";
let adminRequest = 0;

const whenAdmin = new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

const stamp = (value) => (value ? whenAdmin.format(new Date(value)) : "brak");

const openAdmin = async () => {
    if (!currentUser?.admin) return;
    adminBox.hidden = false;
    document.body.classList.add("admin-on");
    await drawAdmin();
};

const closeAdmin = () => {
    adminRequest++;
    adminBox.hidden = true;
    document.body.classList.remove("admin-on");
};

const markReports = (n) => {
    adminReports.hidden = !n;
    adminReports.textContent = n || "";
};

const views = {
    stats: async (isCurrent) => {
        const s = await api("/admin/stats");
        if (isCurrent()) markReports(s.reports);
        return `<div class="admin-head"><div><h2>Przegląd</h2><p>Szybki rzut oka. Kliknij zakładkę po lewej, jak chcesz coś zmienić.</p></div></div>
        <div class="admin-kpis">
            <article><span class="admin-kpi-label">Konta</span><b>${s.users}</b><span>wszystkich graczy</span></article>
            <article><span class="admin-kpi-label">Blokady</span><b>${s.banned}</b><span>wyłączonych kont</span></article>
            <article><span class="admin-kpi-label">Ogłoszenia</span><b>${s.ads}</b><span>wiszą na tablicy</span></article>
            <article><span class="admin-kpi-label">Czat</span><b>${s.messages}</b><span>wysłanych wiadomości</span></article>
            <article class="${s.reports ? "warn" : ""}"><span class="admin-kpi-label">Zgłoszenia</span><b>${s.reports}</b><span>do sprawdzenia</span></article>
            <article><span class="admin-kpi-label">Turnieje</span><b>${s.live}</b><span>trwają teraz</span></article>
        </div>`;
    },
    users: async () => {
        const q = $("#admin-q")?.value.trim() || "";
        const { users } = await api(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        return `<div class="admin-head"><h2>Użytkownicy</h2>
            <form class="admin-search" id="admin-search"><input id="admin-q" value="${esc(q)}" placeholder="Szukaj nicku albo maila"><button class="btn" type="submit">Szukaj</button></form>
        </div>
        <table class="admin-table"><thead><tr><th>Nick</th><th>Mail</th><th>Rola</th><th>Konto</th><th></th></tr></thead>
        <tbody>${users.map((u) => `<tr>
            <td><b>${esc(u.nick)}</b>${u.tag ? ` <em>${esc(u.tag)}</em>` : ""}</td>
            <td>${esc(u.email)}</td>
            <td>${u.is_admin ? "Admin" : "Gracz"}</td>
            <td>${u.banned_at ? "Blokada" : u.email_verified_at ? "Aktywne" : "Czeka na maila"}</td>
            <td class="admin-actions">
                ${u.banned_at
                    ? `<button type="button" class="btn btn-ghost" data-admin-act="unban" data-id="${u.id}">Odblokuj</button>`
                    : `<button type="button" class="btn btn-ghost" data-admin-act="ban" data-id="${u.id}">Zablokuj</button>`}
                ${u.email_verified_at ? "" : `<button type="button" class="btn btn-ghost" data-admin-act="verify" data-id="${u.id}">Potwierdź mail</button>`}
                <button type="button" class="btn btn-ghost" data-admin-act="role" data-id="${u.id}" data-on="${u.is_admin ? "0" : "1"}">${u.is_admin ? "Zabierz admina" : "Daj admina"}</button>
            </td>
        </tr>`).join("")}</tbody></table>`;
    },
    ads: async () => {
        const { ads } = await api("/admin/ads");
        return `<div class="admin-head"><h2>Ogłoszenia</h2><p>Zamknij spam albo stare wpisy.</p></div>
        <table class="admin-table"><thead><tr><th>Kto</th><th>Typ</th><th>Treść</th><th>Status</th><th></th></tr></thead>
        <tbody>${ads.map((a) => `<tr>
            <td><b>${esc(a.nick)}</b>${a.tag ? ` <em>${esc(a.tag)}</em>` : ""}</td>
            <td>${a.type === "lfm" ? "Szuka gracza" : "Szuka drużyny"}</td>
            <td>${esc(a.description)}</td>
            <td>${a.is_closed ? "Zamknięte" : "Wisi"}</td>
            <td>${a.is_closed ? "" : `<button type="button" class="btn btn-ghost" data-admin-act="ad" data-id="${a.id}">Zamknij</button>`}</td>
        </tr>`).join("")}</tbody></table>`;
    },
    reports: async (isCurrent) => {
        const { reports } = await api("/admin/reports");
        if (isCurrent()) markReports(reports.filter((r) => !r.resolved).length);
        return `<div class="admin-head"><h2>Zgłoszenia</h2><p>Ostatnie wiadomości z rozmowy, jeśli ktoś pisał.</p></div>
        <div class="admin-reports">${reports.map((r) => `<article class="admin-card ${r.resolved ? "done" : ""}">
            <header><b>${esc(r.reporter)}</b> zgłasza <b>${esc(r.reported)}</b><time>${stamp(r.created_at)}</time></header>
            <p>${esc(r.reason)}</p>
            ${r.messages?.length ? `<ol>${r.messages.map((m) => `<li><b>${esc(m.nick)}:</b> ${esc(m.content)}</li>`).join("")}</ol>` : ""}
            ${r.resolved ? "<em>Zamknięte</em>" : `<div class="admin-actions">
                <button type="button" class="btn" data-admin-act="resolve" data-id="${r.id}">Oznacz jako załatwione</button>
                <button type="button" class="btn btn-ghost" data-admin-act="ban" data-id="${r.reported_id}">Zablokuj ${esc(r.reported)}</button>
            </div>`}
        </article>`).join("") || "<p>Brak zgłoszeń.</p>"}</div>`;
    },
    tournaments: async () => {
        const { tournaments } = await api("/admin/tournaments");
        const label = { registration: "Zapisy", in_progress: "W trakcie", finished: "Zakończony", cancelled: "Odwołany" };
        return `<div class="admin-head"><h2>Turnieje</h2><p>Zamknij zapisy albo odwołaj event.</p></div>
        <table class="admin-table"><thead><tr><th>Nazwa</th><th>Status</th><th>Składy</th><th>Start</th><th></th></tr></thead>
        <tbody>${tournaments.map((t) => `<tr>
            <td><b>${esc(t.name)}</b></td>
            <td>${label[t.status] || t.status}</td>
            <td>${t.teams} / ${t.max_teams}</td>
            <td>${stamp(t.starts_at)}</td>
            <td class="admin-actions">
                ${t.status === "registration" ? `<button type="button" class="btn btn-ghost" data-admin-act="close-reg" data-id="${t.id}">Zamknij zapisy</button>` : ""}
                ${t.status === "registration" || t.status === "in_progress" ? `<button type="button" class="btn btn-ghost" data-admin-act="cancel" data-id="${t.id}">Odwołaj</button>` : ""}
            </td>
        </tr>`).join("")}</tbody></table>`;
    },
    notice: async () => {
        const { announcement } = await api("/admin/announcement");
        const text = announcement?.content || "";
        const on = Boolean(announcement);
        return `<div class="admin-head"><div><h2>Komunikat</h2><p>Krótka wiadomość na górze strony. Goście nie mogą jej schować. Zalogowany może ją tylko u siebie ukryć, a Ty wyłączasz ją dla wszystkich tutaj.</p></div>
            <span class="admin-pill ${on ? "on" : ""}">${on ? "Widoczny na stronie" : "Wyłączony"}</span>
        </div>
        <form class="admin-form admin-notice" id="admin-notice">
            <label>Co mają zobaczyć
                <textarea name="content" id="admin-notice-text" rows="3" maxlength="200" placeholder="np. Zapisy na Nocny Turniej BO3 zamykamy w piątek o 18.">${esc(text)}</textarea>
            </label>
            <div class="admin-notice-meta"><span>Pisz krótko i konkretnie.</span><span id="admin-notice-count">${text.length}/200</span></div>
            <div class="admin-preview" aria-hidden="true">
                <span class="notice-tag">Komunikat</span>
                <p id="admin-notice-preview">${esc(text) || "Tu zobaczysz podgląd zanim klikniesz publikuj."}</p>
            </div>
            <div class="admin-actions">
                <button type="submit" class="btn">${on ? "Zaktualizuj komunikat" : "Pokaż na stronie"}</button>
                <button type="button" class="btn btn-ghost" id="admin-notice-off" ${on ? "" : "disabled"}>Wyłącz dla wszystkich</button>
            </div>
        </form>`;
    },
};

const drawAdmin = async () => {
    const request = ++adminRequest;
    const isCurrent = () => request === adminRequest;
    $$("button", adminNav).forEach((btn) => btn.classList.toggle("active", btn.dataset.view === adminView));
    try {
        const html = await views[adminView](isCurrent);
        if (isCurrent()) adminMain.innerHTML = html;
    } catch (err) {
        if (isCurrent()) adminMain.innerHTML = `<p class="admin-err">${esc(err.message)}</p>`;
    }
};

const runAdmin = async (act, id, extra) => {
    const routes = {
        ban: [`/admin/users/${id}/ban`, {}],
        unban: [`/admin/users/${id}/unban`, {}],
        verify: [`/admin/users/${id}/verify`, {}],
        role: [`/admin/users/${id}/admin`, { on: extra === "1" }],
        ad: [`/admin/ads/${id}`, undefined, "DELETE"],
        resolve: [`/admin/reports/${id}/resolve`, {}],
        cancel: [`/admin/tournaments/${id}/cancel`, {}],
        "close-reg": [`/admin/tournaments/${id}/close-reg`, {}],
    };
    const args = routes[act];
    if (!args) return;
    await api(...args);
    toast("Zrobione.");
    if (act === "ad") loadAds().catch(() => {});
    if (act === "cancel" || act === "close-reg") {
        await loadTournaments().catch(() => toast("Zmiana zapisana, ale nie udało się odświeżyć turniejów. Odśwież stronę.", "err"));
    }
    await drawAdmin();
};

$("#admin-btn").addEventListener("click", openAdmin);
$("#admin-close").addEventListener("click", closeAdmin);
document.addEventListener("click", (e) => {
    if (e.target.closest("[data-admin-open]")) openAdmin();
});

adminNav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    adminView = btn.dataset.view;
    drawAdmin();
});

adminMain.addEventListener("input", (e) => {
    if (e.target.id !== "admin-notice-text") return;
    const text = e.target.value;
    const count = $("#admin-notice-count");
    const preview = $("#admin-notice-preview");
    if (count) count.textContent = `${text.length}/200`;
    if (preview) preview.textContent = text.trim() || "Tu zobaczysz podgląd zanim klikniesz publikuj.";
});

adminMain.addEventListener("submit", async (e) => {
    if (e.target.id === "admin-search") {
        e.preventDefault();
        drawAdmin();
    }
    if (e.target.id === "admin-notice") {
        e.preventDefault();
        try {
            await api("/admin/announcement", { content: e.target.content.value.trim() });
            localStorage.removeItem("cgp-notice");
            toast("Komunikat wisi na górze strony.");
            loadNotice();
            drawAdmin();
        } catch (err) {
            toast(err.message, "err");
        }
    }
});

adminMain.addEventListener("click", async (e) => {
    if (e.target.id === "admin-notice-off") {
        await api("/admin/announcement", undefined, "DELETE");
        toast("Pasek schowany.");
        showNotice(null);
        drawAdmin();
        return;
    }
    const btn = e.target.closest("[data-admin-act]");
    if (!btn) return;
    try {
        await runAdmin(btn.dataset.adminAct, btn.dataset.id, btn.dataset.on);
    } catch (err) {
        toast(err.message, "err");
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !adminBox.hidden) closeAdmin();
});

document.addEventListener("cgp:user", () => {
    if (!currentUser?.admin) closeAdmin();
});
