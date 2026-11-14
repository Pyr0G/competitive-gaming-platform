const POOL = [
    ["dust2", "Dust2", "#c9a36a"],
    ["mirage", "Mirage", "#d6914f"],
    ["inferno", "Inferno", "#c4553a"],
    ["nuke", "Nuke", "#4c9bff"],
    ["ancient", "Ancient", "#2ea57a"],
    ["anubis", "Anubis", "#d9b64c"],
    ["train", "Train", "#8b9aa7"],
];
const ORDER = { bo1: ["ban", "ban", "ban", "ban", "ban", "ban"], bo3: ["ban", "ban", "pick", "pick", "ban", "ban"] };

const veto = { format: "bo1", steps: [] };
const vetoA = $("#veto-a");
const vetoB = $("#veto-b");
const vetoMaps = $("#veto-maps");
const vetoTurn = $("#veto-turn");
const mapName = (id) => POOL.find(([m]) => m === id)[1];

const refreshVetoTeams = () => {
    const before = [vetoA.value, vetoB.value];
    const tags = Object.keys(TEAMS);
    const options = Object.entries(TEAMS).map(([tag, name]) => `<option value="${esc(tag)}">${esc(name)}</option>`).join("");
    [vetoA, vetoB].forEach((select, i) => {
        select.innerHTML = options;
        select.value = tags.includes(before[i]) ? before[i] : tags[i] || tags[0] || "";
    });
};
refreshVetoTeams();

vetoMaps.innerHTML = POOL.map(([id, name, color], i) => `<button type="button" class="veto-map" data-veto="${id}" style="--m: ${color}; --n: ${i}">
    <span class="vm-name">${name}</span>
    <span class="vm-state"></span>
</button>`).join("");

const vetoTeam = (i) => (i % 2 ? vetoB : vetoA).value;

const renderVeto = () => {
    const order = ORDER[veto.format];
    const step = veto.steps.length;
    const finished = step >= order.length;
    const decider = finished ? POOL.find(([id]) => !veto.steps.some((s) => s.map === id))[0] : null;

    $$(".veto-map", vetoMaps).forEach((btn) => {
        const id = btn.dataset.veto;
        const s = veto.steps.find((x) => x.map === id);
        const state = s ? s.action : id === decider ? "decider" : "";
        btn.dataset.state = state;
        btn.className = `veto-map ${state === "ban" ? "banned" : state === "pick" ? "picked" : state}`;
        $(".vm-state", btn).textContent = s ? tx(s.action === "ban" ? "veto.bannedBy" : "veto.pickedBy", { team: s.team }) : state ? tx("veto.decider") : "";
    });
    $$(".veto-map", vetoMaps).forEach((btn) => { btn.disabled = Boolean(btn.dataset.state || finished); });

    $("#veto-log").innerHTML = veto.steps.map((s) => `<li>${tr(s.action === "ban" ? "veto.logBan" : "veto.logPick", { team: s.team, map: mapName(s.map) })}</li>`).join("")
        + (decider ? `<li class="veto-decider">${tr("veto.logDecider", { map: mapName(decider) })}</li>` : "");

    if (finished) {
        const played = [...veto.steps.filter((s) => s.action === "pick").map((s) => s.map), decider];
        vetoTurn.innerHTML = tr("veto.mapsSelected", { maps: I18N.formatList(played.map(mapName)) });
        vetoTurn.dataset.action = "done";
    } else {
        vetoTurn.innerHTML = tr(order[step] === "ban" ? "veto.turnBan" : "veto.turnPick", { step: step + 1, total: order.length, team: TEAMS[vetoTeam(step)] });
        vetoTurn.dataset.action = order[step];
    }
};

const vetoPick = (id) => {
    const step = veto.steps.length;
    if (step >= ORDER[veto.format].length || veto.steps.some((s) => s.map === id)) return;
    veto.steps.push({ map: id, action: ORDER[veto.format][step], team: vetoTeam(step) });
    renderVeto();
};

const resetVeto = () => {
    veto.steps = [];
    renderVeto();
};

vetoMaps.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-veto]");
    if (btn) vetoPick(btn.dataset.veto);
});

$("#veto-format").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-format]");
    if (!btn) return;
    veto.format = btn.dataset.format;
    $$("#veto-format .tab").forEach((tab) => tab.classList.toggle("active", tab === btn));
    $$("#veto-format .tab").forEach((tab) => tab.setAttribute("aria-pressed", String(tab === btn)));
    resetVeto();
});

[vetoA, vetoB].forEach((select) => select.addEventListener("change", resetVeto));
$("#veto-reset").addEventListener("click", resetVeto);

$("#veto-auto").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    while (veto.steps.length < ORDER[veto.format].length) {
        const free = POOL.filter(([id]) => !veto.steps.some((s) => s.map === id));
        vetoPick(free[Math.floor(Math.random() * free.length)][0]);
        await wait(reducedMotion ? 0 : 320);
    }
    btn.disabled = false;
});

renderVeto();
document.addEventListener("cgp:languagechange", renderVeto);
document.addEventListener("cgp:tournaments", () => {
    refreshVetoTeams();
    renderVeto();
});
