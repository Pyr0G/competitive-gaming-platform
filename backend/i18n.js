import en from "../frontend/locales/en.js";
import pl from "../frontend/locales/pl.js";
import locale from "../frontend/i18n-core.js";

export const catalogs = Object.freeze({ en, pl });

const acceptedLocales = (header = "") => String(header).slice(0, 512).split(",").slice(0, 16).map((part, index) => {
    const [tag, ...parameters] = part.trim().split(";");
    const weight = parameters.find((value) => /^q=/i.test(value.trim()));
    const quality = weight ? Number(weight.trim().slice(2)) : 1;
    return { tag, quality, index };
}).filter(({ quality }) => quality > 0 && quality <= 1).sort((a, b) => b.quality - a.quality || a.index - b.index).map(({ tag }) => tag);

export const translateRequest = (req = {}) => locale.create(catalogs, {
    language: req.query?.lang || req.headers?.["x-cgp-language"],
    region: req.query?.region || req.headers?.["x-cgp-region"],
    locales: acceptedLocales(req.headers?.["accept-language"]),
});

export const localeQuery = (req) => {
    const { language, region } = translateRequest(req);
    return new URLSearchParams({ lang: language, region }).toString();
};

export const failure = (req, key, values = {}) => ({
    error: translateRequest(req).t(key, values), errorKey: key, values,
});

export const message = (req, key, values = {}) => ({
    message: translateRequest(req).t(key, values), messageKey: key, values,
});
