const topbar = document.getElementById("topbar");

const onScroll = () => topbar.classList.toggle("scrolled", window.scrollY > 20);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

document.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    const duration = 1200;
    const start = performance.now() + 800;

    const tick = (now) => {
        const progress = Math.min(Math.max((now - start) / duration, 0), 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
});

document.querySelectorAll(".ad").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        card.style.setProperty("--my", `${e.clientY - rect.top}px`);
    });
});

const filters = document.getElementById("filters");
const ads = [...document.querySelectorAll(".ad")];
const adsCount = document.getElementById("ads-count");
const adsEmpty = document.getElementById("ads-empty");

const applyFilters = () => {
    const role = filters.role.value;
    const level = filters.level.value;
    const time = filters.time.value;
    const [min, max] = level ? level.split("-").map(Number) : [1, 10];
    let shown = 0;

    ads.forEach((ad) => {
        const adLevel = Number(ad.dataset.level);
        const match =
            (!role || ad.dataset.role === role) &&
            adLevel >= min && adLevel <= max &&
            (!time || ad.dataset.time.split(" ").includes(time));

        ad.classList.toggle("hidden", !match);
        if (match) shown++;
    });

    adsCount.innerHTML = `Ogłoszenia: <b>${shown}</b>`;
    adsEmpty.hidden = shown > 0;
};

filters.addEventListener("change", applyFilters);
applyFilters();

const faceitForm = document.getElementById("faceit-form");
const faceitInput = document.getElementById("faceit-link");
const faceitMsg = document.getElementById("faceit-msg");
const faceitPattern = /^https?:\/\/(www\.)?faceit\.com\/[a-z]{2}\/cs2\/room\/(1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/.*)?$/i;

const showFaceitMessage = (text, type) => {
    faceitMsg.innerHTML = text;
    faceitMsg.className = `faceit-msg ${type}`;
};

faceitForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = faceitInput.value.trim();
    const found = value.match(faceitPattern);

    if (!value) {
        showFaceitMessage("Najpierw wklej link do pokoju meczowego.", "err");
    } else if (!found) {
        showFaceitMessage("To nie wygląda na link do meczu CS2 na FACEIT.", "err");
    } else {
        showFaceitMessage(`Link wygląda dobrze. ID meczu: <code>${found[2]}</code>`, "ok");
        return;
    }

    faceitForm.classList.remove("shake");
    void faceitForm.offsetWidth;
    faceitForm.classList.add("shake");
});
