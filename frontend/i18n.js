(() => {
    const STORAGE_KEY = "cgp-language";
    const supported = ["pl", "en"];
    const fallback = "pl";
    const dictionaries = window.CGP_LOCALES || {};

    const getSavedLanguage = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return supported.includes(saved) ? saved : fallback;
        } catch {
            return fallback;
        }
    };

    let language = getSavedLanguage();

    const translate = (root = document) => {
        const dictionary = dictionaries[language] || dictionaries[fallback] || {};
        root.querySelectorAll?.("[data-i18n]").forEach((element) => {
            const value = dictionary[element.dataset.i18n];
            if (typeof value === "string") element.textContent = value;
        });
        root.querySelectorAll?.("[data-i18n-attr]").forEach((element) => {
            const [attribute, key] = element.dataset.i18nAttr.split(":");
            const value = dictionary[key];
            if (attribute && typeof value === "string") element.setAttribute(attribute, value);
        });
        document.documentElement.lang = language;
        document.title = dictionary["meta.title"] || document.title;
    };

    const setLanguage = (nextLanguage) => {
        if (!supported.includes(nextLanguage)) return;
        language = nextLanguage;
        try {
            localStorage.setItem(STORAGE_KEY, language);
        } catch {
            // Language selection still works for the current page.
        }
        translate();
        document.dispatchEvent(new CustomEvent("cgp:languagechange", {
            detail: { language, locale: getLocale() }
        }));
    };

    const getLocale = () => {
        const dictionary = dictionaries[language] || dictionaries[fallback] || {};
        return dictionary["format.locale"] || "pl-PL";
    };

    const formatDate = (value, options = {}) =>
        new Intl.DateTimeFormat(getLocale(), options).format(new Date(value));

    const formatNumber = (value, options = {}) =>
        new Intl.NumberFormat(getLocale(), options).format(value);

    const formatCurrency = (value, currency = "PLN", options = {}) =>
        new Intl.NumberFormat(getLocale(), { style: "currency", currency, ...options }).format(value);

    window.CGP_I18N = Object.freeze({
        get language() { return language; },
        get locale() { return getLocale(); },
        setLanguage,
        translate,
        formatDate,
        formatNumber,
        formatCurrency
    });

    const selector = document.getElementById("language-select");
    if (selector) {
        selector.value = language;
        selector.addEventListener("change", () => setLanguage(selector.value));
    }

    translate();
})();
