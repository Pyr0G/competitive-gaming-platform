import { config } from "./config.js";

const layout = (title, text, button, link) => `
<div style="background:#0f1923;padding:32px;font-family:Arial,sans-serif;color:#ece8e1">
    <div style="max-width:480px;margin:0 auto;background:#16222e;border-top:3px solid #ff4655;padding:28px">
        <h1 style="margin:0 0 12px;font-size:22px;color:#ece8e1">${title}</h1>
        <p style="margin:0 0 24px;line-height:1.6;color:#8b9aa7">${text}</p>
        <a href="${link}" style="display:inline-block;background:#ff4655;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px">${button}</a>
        <p style="margin:24px 0 0;font-size:12px;color:#8b9aa7">Jeśli przycisk nie działa, skopiuj ten link:<br>${link}</p>
    </div>
</div>`;

export const sendMail = async ({ to, subject, title, text, button, link }) => {
    if (!config.brevoKey || !config.mailFrom) {
        console.log(`[mail] Do: ${to} | ${subject} | ${link}`);
        return;
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": config.brevoKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
            sender: { email: config.mailFrom, name: config.mailName },
            to: [{ email: to }],
            subject,
            htmlContent: layout(title, text, button, link),
            textContent: `${text}\n\n${link}`,
        }),
    });

    if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
};

export const sendVerifyMail = (to, nick, link) => sendMail({
    to,
    subject: "Potwierdź konto w CGP",
    title: `Cześć ${nick}!`,
    text: "Dzięki za rejestrację. Kliknij przycisk, żeby potwierdzić maila i aktywować konto. Link działa przez 24 godziny.",
    button: "Aktywuj konto",
    link,
});

export const sendResetMail = (to, nick, link) => sendMail({
    to,
    subject: "Zmiana hasła w CGP",
    title: `Cześć ${nick}`,
    text: "Ktoś poprosił o zmianę hasła do Twojego konta. Jeśli to Ty, kliknij przycisk. Link działa przez godzinę. Jeśli to nie Ty, po prostu zignoruj tę wiadomość.",
    button: "Ustaw nowe hasło",
    link,
});
