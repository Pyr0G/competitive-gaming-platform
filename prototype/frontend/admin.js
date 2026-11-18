const adminBox = $("#admin");
const adminMain = $("#admin-main");
const adminNav = $("#admin-nav");
const adminReports = $("#admin-reports");

let adminView = "stats";
let adminRequest = 0;

const stamp = (value) => value ? `<time datetime="${esc(value)}" data-i18n-date="dateTime">${I18N.formatDate(value, { dateStyle: "medium", timeStyle: "short" })}</time>` : tr("common.none");

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
    adminReports.innerHTML = n ? num(n) : "";
};

const views = {
    stats: async (isCurrent) => {
        const s = await api("/admin/stats");
        if (isCurrent()) markReports(s.reports);
        return `<div class="admin-head"><div><h2>${tr("admin.overview")}</h2><p>${tr("admin.overviewHelp")}</p></div></div>
        <div class="admin-kpis">
            <article><span class="admin-kpi-label">${tr("admin.accounts")}</span><b>${num(s.users)}</b><span>${tr("admin.totalUsers")}</span></article>
            <article><span class="admin-kpi-label">${tr("admin.bans")}</span><b>${num(s.banned)}</b><span>${tr("admin.bannedUsers")}</span></article>
            <article><span class="admin-kpi-label">${tr("nav.recruitment")}</span><b>${num(s.ads)}</b><span>${tr("admin.activeAds")}</span></article>
            <article><span class="admin-kpi-label">${tr("admin.chat")}</span><b>${num(s.messages)}</b><span>${tr("admin.sentMessages")}</span></article>
            <article class="${s.reports ? "warn" : ""}"><span class="admin-kpi-label">${tr("admin.reports")}</span><b>${num(s.reports)}</b><span>${tr("admin.pendingReports")}</span></article>
            <article><span class="admin-kpi-label">${tr("nav.tournaments")}</span><b>${num(s.live)}</b><span>${tr("admin.liveTournaments")}</span></article>
        </div>`;
    },
    users: async () => {
        const q = $("#admin-q")?.value.trim() || "";
        const { users } = await api(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        return `<div class="admin-head"><h2>${tr("admin.users")}</h2>
            <form class="admin-search" id="admin-search"><label class="sr-only" for="admin-q">${tr("admin.searchPlaceholder")}</label><input id="admin-q" value="${esc(q)}" placeholder="${esc(tx('admin.searchPlaceholder'))}" data-i18n-attr="placeholder:admin.searchPlaceholder"><button class="btn" type="submit">${tr("action.search")}</button></form>
        </div>
        <table class="admin-table"><thead><tr><th>${tr("field.nick")}</th><th>${tr("admin.email")}</th><th>${tr("admin.role")}</th><th>${tr("admin.account")}</th><th>${tr("common.actions")}</th></tr></thead>
        <tbody>${users.map((u) => `<tr>
            <td><b>${esc(u.nick)}</b>${u.tag ? ` <em>${esc(u.tag)}</em>` : ""}</td>
            <td>${esc(u.email)}</td>
            <td>${tr(u.is_admin ? "admin.administrator" : "admin.player")}</td>
            <td>${tr(u.banned_at ? "admin.banned" : u.email_verified_at ? "admin.active" : "admin.unverified")}</td>
            <td class="admin-actions">
                ${u.banned_at
                    ? `<button type="button" class="btn btn-ghost" data-admin-act="unban" data-id="${u.id}">${tr("admin.restoreAccount")}</button>`
                    : `<button type="button" class="btn btn-ghost" data-admin-act="ban" data-id="${u.id}">${tr("admin.restrictAccount")}</button>`}
                ${u.email_verified_at ? "" : `<button type="button" class="btn btn-ghost" data-admin-act="verify" data-id="${u.id}">${tr("admin.verify")}</button>`}
                <button type="button" class="btn btn-ghost" data-admin-act="role" data-id="${u.id}" data-on="${u.is_admin ? "0" : "1"}">${tr(u.is_admin ? "admin.revoke" : "admin.grant")}</button>
            </td>
        </tr>`).join("")}</tbody></table>`;
    },
    ads: async () => {
        const { ads } = await api("/admin/ads");
        return `<div class="admin-head"><h2>${tr("nav.recruitment")}</h2><p>${tr("admin.adsHelp")}</p></div>
        <table class="admin-table"><thead><tr><th>${tr("admin.author")}</th><th>${tr("admin.type")}</th><th>${tr("admin.content")}</th><th>${tr("common.status")}</th><th>${tr("common.actions")}</th></tr></thead>
        <tbody>${ads.map((a) => `<tr>
            <td><b>${esc(a.nick)}</b>${a.tag ? ` <em>${esc(a.tag)}</em>` : ""}</td>
            <td>${tr(a.type === "lfm" ? "ads.lookingPlayer" : "ads.lookingTeam")}</td>
            <td>${esc(a.description)}</td>
            <td>${tr(a.is_closed ? "admin.closed" : "admin.open")}</td>
            <td>${a.is_closed ? "" : `<button type="button" class="btn btn-ghost" data-admin-act="ad" data-id="${a.id}">${tr("action.close")}</button>`}</td>
        </tr>`).join("")}</tbody></table>`;
    },
    reports: async (isCurrent) => {
        const { reports } = await api("/admin/reports");
        if (isCurrent()) markReports(reports.filter((r) => !r.resolved).length);
        return `<div class="admin-head"><h2>${tr("admin.reports")}</h2><p>${tr("admin.reportsHelp")}</p></div>
        <div class="admin-reports">${reports.map((r) => `<article class="admin-card ${r.resolved ? "done" : ""}">
            <header>${tr("admin.reportedBy", { reporter: r.reporter, reported: r.reported })}${stamp(r.created_at)}</header>
            <p>${esc(r.reason)}</p>
            ${r.messages?.length ? `<ol>${r.messages.map((m) => `<li><b>${esc(m.nick)}:</b> ${esc(m.content)}</li>`).join("")}</ol>` : ""}
            ${r.resolved ? `<em>${tr("admin.closed")}</em>` : `<div class="admin-actions">
                <button type="button" class="btn" data-admin-act="resolve" data-id="${r.id}">${tr("admin.resolve")}</button>
                <button type="button" class="btn btn-ghost" data-admin-act="ban" data-id="${r.reported_id}">${tr("admin.banNamed", { nick: r.reported })}</button>
            </div>`}
        </article>`).join("") || `<p>${tr("admin.noReports")}</p>`}</div>`;
    },
    tournaments: async () => {
        const { tournaments } = await api("/admin/tournaments");
        const label = { registration: "status.open", in_progress: "status.live", finished: "match.completed", cancelled: "admin.cancelled" };
        return `<div class="admin-head"><h2>${tr("nav.tournaments")}</h2><p>${tr("admin.tournamentsHelp")}</p></div>
        <table class="admin-table"><thead><tr><th>${tr("common.name")}</th><th>${tr("common.status")}</th><th>${tr("admin.rosters")}</th><th>${tr("common.start")}</th><th>${tr("common.actions")}</th></tr></thead>
        <tbody>${tournaments.map((t) => `<tr>
            <td><b>${esc(t.name)}</b></td>
            <td>${tr(label[t.status] || "common.toBeConfirmed")}</td>
            <td>${num(t.teams)} / ${num(t.max_teams)}</td>
            <td>${stamp(t.starts_at)}</td>
            <td class="admin-actions">
                ${t.status === "registration" ? `<button type="button" class="btn btn-ghost" data-admin-act="close-reg" data-id="${t.id}">${tr("admin.closeRegistration")}</button>` : ""}
                ${t.status === "registration" || t.status === "in_progress" ? `<button type="button" class="btn btn-ghost" data-admin-act="cancel" data-id="${t.id}">${tr("admin.cancelTournament")}</button>` : ""}
            </td>
        </tr>`).join("")}</tbody></table>`;
    },
    notice: async () => {
        const { announcement } = await api("/admin/announcement");
        const text = announcement?.content || "";
        const on = Boolean(announcement);
        return `<div class="admin-head"><div><h2>${tr("notice.title")}</h2><p>${tr("admin.noticeHelp")}</p></div>
            <span class="admin-pill ${on ? "on" : ""}">${tr(on ? "admin.noticeVisible" : "admin.noticeDisabled")}</span>
        </div>
        <form class="admin-form admin-notice" id="admin-notice">
            <label>${tr("admin.noticeContent")}
                <textarea name="content" id="admin-notice-text" rows="3" maxlength="200" placeholder="${esc(tx('admin.noticePlaceholder'))}" data-i18n-attr="placeholder:admin.noticePlaceholder">${esc(text)}</textarea>
            </label>
            <div class="admin-notice-meta"><span>${tr("admin.noticeAdvice")}</span><span id="admin-notice-count">${text.length}/200</span></div>
            <div class="admin-preview" aria-hidden="true">
                <span class="notice-tag">${tr("notice.title")}</span>
                <p id="admin-notice-preview">${esc(text) || tr("admin.noticePreview")}</p>
            </div>
            <div class="admin-actions">
                <button type="submit" class="btn">${tr(on ? "admin.noticeUpdate" : "admin.noticePublish")}</button>
                <button type="button" class="btn btn-ghost" id="admin-notice-off" ${on ? "" : "disabled"}>${tr("admin.noticeDisable")}</button>
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
        if (isCurrent()) adminMain.innerHTML = `<p class="admin-err">${localizedError(err)}</p>`;
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
    toast("common.saved");
    if (act === "ad") loadAds().catch(() => {});
    if (act === "cancel" || act === "close-reg") {
        await loadTournaments().catch(() => toast("admin.refreshFailed", "err"));
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
    if (preview) {
        delete preview.dataset.i18n;
        if (text.trim()) preview.textContent = text;
        else I18N.bind(preview, "admin.noticePreview");
    }
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
            try { localStorage.removeItem("cgp-notice"); } catch {}
            toast("admin.noticePublished");
            loadNotice();
            drawAdmin();
        } catch (err) {
            toastError(err);
        }
    }
});

adminMain.addEventListener("click", async (e) => {
    if (e.target.closest("#admin-notice-off")) {
        await api("/admin/announcement", undefined, "DELETE");
        toast("admin.noticeHidden");
        showNotice(null);
        drawAdmin();
        return;
    }
    const btn = e.target.closest("[data-admin-act]");
    if (!btn) return;
    try {
        await runAdmin(btn.dataset.adminAct, btn.dataset.id, btn.dataset.on);
    } catch (err) {
        toastError(err);
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !adminBox.hidden) closeAdmin();
});

document.addEventListener("cgp:user", () => {
    if (!currentUser?.admin) closeAdmin();
});
