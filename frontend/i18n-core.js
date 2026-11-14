((root) => {
    const languages = ["en", "pl"];
    const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
    const regionCodes = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
    const parseLocale = (value) => {
        try { return new Intl.Locale(value); } catch { return null; }
    };
    const resolve = ({ language, region, locales = [] } = {}) => {
        const primary = locales.map(parseLocale).find(Boolean);
        const detected = primary?.region || primary?.maximize().region;
        const selectedRegion = regionCodes.includes(region) ? region : regionCodes.includes(detected) ? detected : "GB";
        const selectedLanguage = languages.includes(language) ? language : selectedRegion === "PL" ? "pl" : "en";
        return { language: selectedLanguage, region: selectedRegion, locale: `${selectedLanguage}-${selectedRegion}` };
    };
    const create = (catalogs, preferences = {}) => {
        const settings = resolve(preferences);
        const lookup = (key, values) => {
            const entry = catalogs[settings.language]?.[key] ?? catalogs.en?.[key];
            if (typeof entry === "string") return entry;
            if (entry && typeof entry === "object") {
                const category = new Intl.PluralRules(settings.language).select(Number(values.count));
                return entry[category] ?? entry.other;
            }
            return key;
        };
        const display = (value) => typeof value === "number" ? new Intl.NumberFormat(settings.locale).format(value) : String(value ?? "");
        const interpolate = (key, values, encode) => lookup(key, values).replace(/<\/?(?:b|strong|em|code)>/g, "").replace(/\{(\w+)\}/g, (match, name) =>
            Object.hasOwn(values, name) ? encode(display(values[name])) : match);
        return Object.freeze({
            ...settings,
            has: (key) => typeof key === "string" && (Object.hasOwn(catalogs[settings.language] || {}, key) || Object.hasOwn(catalogs.en || {}, key)),
            t: (key, values = {}) => interpolate(key, values, String),
            html: (key, values = {}) => {
                const template = escape(lookup(key, values)).replace(/&lt;(\/?(?:b|strong|em|code))&gt;/g, "<$1>");
                return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? escape(display(values[name])) : match);
            },
            number: (value, options = {}) => new Intl.NumberFormat(settings.locale, options).format(value),
            currency: (value, currency = "PLN", options = {}) => new Intl.NumberFormat(settings.locale, { style: "currency", currency, ...options }).format(value),
            date: (value, options = {}) => {
                if (!value) return interpolate("common.toBeConfirmed", {}, String);
                const date = new Date(value);
                return Number.isNaN(date.getTime()) ? interpolate("common.toBeConfirmed", {}, String) : new Intl.DateTimeFormat(settings.locale, options).format(date);
            },
            relative: (value, unit, options = {}) => new Intl.RelativeTimeFormat(settings.locale, { numeric: "auto", ...options }).format(value, unit),
            list: (items, options = {}) => new Intl.ListFormat(settings.locale, { style: "long", type: "conjunction", ...options }).format(items),
        });
    };
    const api = Object.freeze({ create, resolve, languages, regionCodes, escape });
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.CGP_LOCALE = api;
})(globalThis);
