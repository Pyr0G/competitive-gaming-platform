import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module(new URL("./config.js", import.meta.url).href, {
    namedExports: { config: { brevoKey: "test-only-key", mailFrom: "cgp@example.com", mailName: "CGP" } },
});
const { sendVerifyMail, sendResetMail } = await import("./mail.js");

test("account emails use the requested language in both versions and escape names and link attributes", async () => {
    const sent = [];
    const request = mock.method(globalThis, "fetch", async (url, options) => {
        assert.equal(url, "https://api.brevo.com/v3/smtp/email");
        sent.push(JSON.parse(options.body));
        return { ok: true };
    });
    try {
        await sendVerifyMail("player@example.com", '<img src=x onerror="alert(1)">', "https://example.com/?token=test&lang=en", "en");
        await sendResetMail("player@example.com", "Gracz", "https://example.com/?reset=test&lang=pl", "pl");
        assert.equal(sent[0].subject, "Confirm your CGP account");
        assert.match(sent[0].htmlContent, /<html lang="en">/);
        assert.doesNotMatch(sent[0].htmlContent, /<img/);
        assert.match(sent[0].htmlContent, /&amp;lang=en/);
        assert.match(sent[0].textContent, /24 hours/);
        assert.equal(sent[1].subject, "Zmień hasło do konta CGP");
        assert.match(sent[1].htmlContent, /<html lang="pl">/);
        assert.match(sent[1].textContent, /w ciągu godziny/);
    } finally {
        request.mock.restore();
    }
});
