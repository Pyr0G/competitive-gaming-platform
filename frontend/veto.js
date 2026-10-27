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

const teamOptions = Object.entries(TEAMS).map(([tag, name]) => `<option value="${tag}">${esc(name)}</option>`).join("");
vetoA.innerHTML = teamOptions;
vetoB.innerHTML = teamOptions;
vetoA.value = "AKD";
vetoB.value = "SGM";

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
        if (btn.dataset.state === state) return;
        btn.dataset.state = state;
        btn.className = `veto-map ${state === "ban" ? "banned" : state === "pick" ? "picked" : state}`;
        $(".vm-state", btn).textContent = s ? `${s.action === "ban" ? "Ban" : "Pick"} ${s.team}` : state ? "Decydująca" : "";
    });
    $$(".veto-map", vetoMaps).forEach((btn) => { btn.disabled = Boolean(btn.dataset.state || finished); });

    $("#veto-log").innerHTML = veto.steps.map((s) => `<li><b>${esc(s.team)}</b> ${s.action === "ban" ? "banuje" : "wybiera"} ${mapName(s.map)}</li>`).join("")
        + (decider ? `<li class="veto-decider">Decydująca: <b>${mapName(decider)}</b></li>` : "");

    if (finished) {
        const played = [...veto.steps.filter((s) => s.action === "pick").map((s) => s.map), decider];
        vetoTurn.innerHTML = `Gramy: <b>${played.map(mapName).join(", ")}</b>`;
        vetoTurn.dataset.action = "done";
    } else {
        vetoTurn.innerHTML = `Ruch ${step + 1} z ${order.length}: <b>${esc(TEAMS[vetoTeam(step)])}</b> ${order[step] === "ban" ? "banuje" : "wybiera"} mapę`;
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
