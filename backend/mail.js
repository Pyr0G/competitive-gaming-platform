import { config } from "./config.js";
import { translateRequest } from "./i18n.js";
import locale from "../frontend/i18n-core.js";

const layout = ({ language, title, text, button, link, fallback }) => `<!DOCTYPE html>
<html lang="${language}"><body style="background:#0f1923;padding:32px;font-family:Arial,sans-serif;color:#ece8e1">
    <div style="max-width:480px;margin:0 auto;background:#16222e;border-top:3px solid #ff4655;padding:28px">
        <h1 style="margin:0 0 12px;font-size:22px">${locale.escape(title)}</h1>
        <p style="margin:0 0 24px;line-height:1.6;color:#b2bdc6">${locale.escape(text)}</p>
        <a href="${locale.escape(link)}" style="display:inline-block;background:#d92d3d;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px">${locale.escape(button)}</a>
        <p style="margin:24px 0 0;font-size:12px;color:#b2bdc6">${locale.escape(fallback)}<br><a href="${locale.escape(link)}" style="color:#ece8e1">${locale.escape(link)}</a></p>
    </div>
</body></html>`;

export const sendMail = async ({ to, subject, title, text, button, link, language = "en", fallback }) => {
    if (!config.brevoKey || !config.mailFrom) {
        console.log(`[mail] To: ${to} | ${subject} | ${link}`);
        return;
    }
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": config.brevoKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
            sender: { email: config.mailFrom, name: config.mailName },
            to: [{ email: to }],
            subject,
            htmlContent: layout({ language, title, text, button, link, fallback }),
            textContent: `${title}\n\n${text}\n\n${button}\n${link}\n\n${fallback}\n${link}`,
        }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
};

const accountMail = (kind, to, nick, link, language) => {
    const i18n = translateRequest({ headers: { "x-cgp-language": language } });
    return sendMail({
        to, link, language: i18n.language,
        subject: i18n.t(`mail.${kind}Subject`),
        title: i18n.t("mail.greeting", { nick }),
        text: i18n.t(`mail.${kind}Text`),
        button: i18n.t(`mail.${kind}Button`),
        fallback: i18n.t("mail.linkFallback"),
    });
};

export const sendVerifyMail = (to, nick, link, language = "en") => accountMail("verify", to, nick, link, language);
export const sendResetMail = (to, nick, link, language = "en") => accountMail("reset", to, nick, link, language);
