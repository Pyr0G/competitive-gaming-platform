(() => {
    const core = window.CGP_LOCALE;
    const read = (key) => {
        try { return localStorage.getItem(key); } catch { return null; }
    };
    const save = (key, value) => {
        try {
            if (value) localStorage.setItem(key, value);
            else localStorage.removeItem(key);
        } catch {}
    };
    let languagePreference = read("cgp-language");
    let regionPreference = read("cgp-region");
    const linkPreferences = new URLSearchParams(location.search);
    if (!core.languages.includes(languagePreference) && core.languages.includes(linkPreferences.get("lang"))) {
        languagePreference = linkPreferences.get("lang");
        save("cgp-language", languagePreference);
    }
    if (!core.regionCodes.includes(regionPreference) && core.regionCodes.includes(linkPreferences.get("region"))) {
        regionPreference = linkPreferences.get("region");
        save("cgp-region", regionPreference);
    }
    let current;
    const rebuild = () => {
        const locales = navigator.languages?.length
            ? navigator.languages
            : [navigator.language].filter(Boolean);

        current = core.create(window.CGP_LOCALES, {
            language: languagePreference,
            region: regionPreference,
            locales
        });
    };
    rebuild();
    const t = (key, values) => current.t(key, values);
    const html = (key, values) => current.html(key, values);
    const params = (element) => {
        try { return JSON.parse(element.dataset.i18nParams || "{}"); } catch { return {}; }
    };
    const nodes = (root, selector) => [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
    const translate = (root = document) => {
        nodes(root, "[data-i18n]").forEach((element) => {
            element.textContent = t(element.dataset.i18n, params(element));
        });
        nodes(root, "[data-i18n-html]").forEach((element) => {
            element.innerHTML = html(element.dataset.i18nHtml, params(element));
        });
        nodes(root, "[data-i18n-attr]").forEach((element) => {
            element.dataset.i18nAttr.split(";").forEach((pair) => {
                const [attribute, key] = pair.split(":");
                if (["title", "placeholder", "aria-label", "alt", "data-note", "data-path", "content"].includes(attribute)) element.setAttribute(attribute, t(key, params(element)));
            });
        });
        nodes(root, "[data-i18n-number]").forEach((element) => {
            element.textContent = current.number(Number(element.dataset.i18nNumber));
        });
        nodes(root, "[data-i18n-date]").forEach((element) => {
            element.textContent = current.date(element.getAttribute("datetime"), element.dataset.i18nDate === "time" ? { hour: "2-digit", minute: "2-digit" } : { dateStyle: "medium", timeStyle: "short" });
        });
        document.documentElement.lang = current.language;
        document.title = t("meta.title");
    };
    const bind = (element, key, values = {}, rich = false) => {
        delete element.dataset.i18n;
        delete element.dataset.i18nHtml;
        element.dataset[rich ? "i18nHtml" : "i18n"] = key;
        element.dataset.i18nParams = JSON.stringify(values);
        if (rich) element.innerHTML = html(key, values);
        else element.textContent = t(key, values);
    };
    const fragment = (key, values = {}) => `<span data-i18n-html="${core.escape(key)}" data-i18n-params="${core.escape(JSON.stringify(values))}">${html(key, values)}</span>`;
    const syncControls = () => {
        const language = document.getElementById("language-select");
        const region = document.getElementById("region-select");
        const code = document.getElementById("current-language");
        if (code) code.textContent = current.language.toUpperCase();
        if (language) language.value = core.languages.includes(languagePreference) ? languagePreference : "";
        if (region) {
            const names = new Intl.DisplayNames([current.language], { type: "region" });
            const options = core.regionCodes.map((code) => [code, names.of(code)]).sort((a, b) => a[1].localeCompare(b[1], current.locale));
            region.replaceChildren(...[["", t("settings.regionAuto")], ...options].map(([code, name]) => {
                const option = document.createElement("option");
                option.value = code;
                option.textContent = name;
                return option;
            }));
            region.value = core.regionCodes.includes(regionPreference) ? regionPreference : "";
        }
    };
    const change = () => {
        rebuild();
        translate();
        syncControls();
        document.dispatchEvent(new CustomEvent("cgp:languagechange", { detail: { language: current.language, region: current.region, locale: current.locale } }));
        const status = document.getElementById("locale-status");
        if (status) bind(status, "settings.applied");
    };
    const setLanguage = (value) => {
        if (value && !core.languages.includes(value)) return;
        languagePreference = value;
        save("cgp-language", value);
        change();
    };
    const setRegion = (value) => {
        if (value && !core.regionCodes.includes(value)) return;
        regionPreference = value;
        save("cgp-region", value);
        change();
    };
    window.CGP_I18N = Object.freeze({
        get language() { return current.language; },
        get region() { return current.region; },
        get locale() { return current.locale; },
        t, html, bind, fragment, translate, setLanguage, setRegion,
        has: (key) => current.has(key),
        formatDate: (value, options) => current.date(value, options),
        formatNumber: (value, options) => current.number(value, options),
        formatCurrency: (value, currency, options) => current.currency(value, currency, options),
        formatRelative: (value, unit, options) => current.relative(value, unit, options),
        formatList: (items, options) => current.list(items, options),
    });
    document.getElementById("language-select")?.addEventListener("change", (event) => setLanguage(event.target.value));
    document.getElementById("region-select")?.addEventListener("change", (event) => setRegion(event.target.value));
    window.addEventListener("languagechange", change);
    window.addEventListener("storage", (event) => {
        if (event.key !== null && !["cgp-language", "cgp-region"].includes(event.key)) return;
        languagePreference = read("cgp-language");
        regionPreference = read("cgp-region");
        change();
    });
    translate();
    syncControls();
})();
