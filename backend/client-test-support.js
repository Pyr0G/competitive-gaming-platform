import { readFileSync } from "node:fs";
import vm from "node:vm";
import en from "../frontend/locales/en.js";
import pl from "../frontend/locales/pl.js";
import core from "../frontend/i18n-core.js";

const runtime = readFileSync(new URL("../frontend/i18n.js", import.meta.url), "utf8");

export const createClientTranslations = (language = "en") => {
    const context = vm.createContext({
        window: { CGP_LOCALE: core, CGP_LOCALES: { en, pl }, addEventListener() {} },
        document: { documentElement: {}, querySelectorAll: () => [], getElementById: () => null, dispatchEvent() {} },
        localStorage: { getItem: (key) => key === "cgp-language" ? language : null },
        navigator: { languages: ["en-GB"] }, location: { search: "" }, URLSearchParams,
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    });
    vm.runInContext(runtime, context);
    const I18N = context.window.CGP_I18N;
    return {
        I18N, tx: I18N.t, tr: I18N.fragment,
        num: (value) => `<span data-i18n-number="${value}">${I18N.formatNumber(value)}</span>`,
        localizedError: (error) => error.data?.errorKey ? I18N.fragment(error.data.errorKey, error.data.values) : core.escape(error.message),
    };
};
