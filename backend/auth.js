import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "./db.js";
import { config } from "./config.js";
import { sendVerifyMail, sendResetMail } from "./mail.js";

export const auth = Router();

const COOKIE = "cgp_session";
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const nickPattern = /^[\p{L}\p{N}_.-]{3,32}$/u;

const newToken = () => {
    const token = crypto.randomBytes(32).toString("hex");
    return { token, hash: hashToken(token) };
};

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

const publicUser = (u) => ({ id: Number(u.id), nick: u.nick, email: u.email });

const hits = new Map();

export const limit = (max, minutes) => (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
        hits.set(key, { count: 1, reset: now + minutes * 60000 });
        return next();
    }
    if (++entry.count > max) return res.status(429).json({ error: "Za dużo prób. Odczekaj chwilę i spróbuj znowu." });
    next();
};

export const readSession = (req, res, next) => {
    const cookie = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
    if (cookie) {
        try {
            req.userId = jwt.verify(decodeURIComponent(cookie.slice(COOKIE.length + 1)), config.jwtSecret).id;
        } catch {
            req.userId = null;
        }
    }
    next();
};

const setSession = (res, userId) => {
    res.cookie(COOKIE, jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: "7d" }), {
        httpOnly: true,
        sameSite: "lax",
        secure: config.production,
        maxAge: 7 * 24 * 3600 * 1000,
    });
};

const createVerification = async (user) => {
    const { token, hash } = newToken();
    await query("INSERT INTO email_verifications (user_id, token_hash) VALUES ($1, $2)", [user.id, hash]);
    await sendVerifyMail(user.email, user.nick, `${config.appUrl}/api/auth/verify?token=${token}`);
};

auth.post("/register", limit(10, 15), async (req, res) => {
    const nick = String(req.body.nick || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!nickPattern.test(nick)) return res.status(400).json({ error: "Nick musi mieć od 3 do 32 znaków: litery, cyfry oraz _ . -" });
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: "Podaj poprawny e-mail." });
    if (password.length < 8) return res.status(400).json({ error: "Hasło musi mieć co najmniej 8 znaków." });

    try {
        const hash = await bcrypt.hash(password, 10);
        const { rows } = await query(
            "INSERT INTO users (nick, email, password_hash) VALUES ($1, $2, $3) RETURNING id, nick, email",
            [nick, email, hash],
        );
        try {
            await createVerification(rows[0]);
        } catch (mailErr) {
            console.error(mailErr);
            return res.status(201).json({ message: "Konto założone, ale mail nie wyszedł. Spróbuj wysłać link ponownie z okna logowania." });
        }
        res.status(201).json({ message: `Konto założone. Kliknij link, który wysłaliśmy na ${email}, żeby je aktywować.` });
    } catch (err) {
        if (err.code === "23505") {
            const field = err.constraint === "users_email_unique" ? "Ten e-mail ma już konto." : "Ten nick jest już zajęty.";
            return res.status(409).json({ error: field });
        }
        console.error(err);
        res.status(500).json({ error: "Nie udało się założyć konta. Spróbuj za chwilę." });
    }
});

auth.get("/verify", async (req, res) => {
    const { rows } = await query(
        `UPDATE email_verifications SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id`,
        [hashToken(req.query.token)],
    );
    if (!rows.length) return res.redirect("/?verified=0");
    await query("UPDATE users SET email_verified_at = NOW() WHERE id = $1", [rows[0].user_id]);
    setSession(res, Number(rows[0].user_id));
    res.redirect("/?verified=1");
});

auth.post("/resend", limit(5, 15), async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const { rows } = await query("SELECT id, nick, email FROM users WHERE LOWER(email) = $1 AND email_verified_at IS NULL", [email]);
    if (rows.length) await createVerification(rows[0]).catch((err) => console.error(err));
    res.json({ message: "Jeśli to konto czeka na aktywację, wysłaliśmy nowy link." });
});

auth.post("/login", limit(20, 15), async (req, res) => {
    const login = String(req.body.login || "").trim();
    const password = String(req.body.password || "");
    if (!login || !password) return res.status(400).json({ error: "Wpisz nick albo e-mail i hasło." });

    const { rows } = await query(
        "SELECT id, nick, email, password_hash, email_verified_at FROM users WHERE LOWER(nick) = LOWER($1) OR LOWER(email) = LOWER($1)",
        [login],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: "Zły nick, e-mail albo hasło." });
    }
    if (!user.email_verified_at) {
        return res.status(403).json({ error: "Najpierw potwierdź maila. Link jest w skrzynce (zajrzyj też do spamu).", unverified: user.email });
    }

    setSession(res, Number(user.id));
    res.json({ user: publicUser(user) });
});

auth.post("/logout", (req, res) => {
    res.clearCookie(COOKIE);
    res.json({ message: "Wylogowano." });
});

auth.get("/me", async (req, res) => {
    if (!req.userId) return res.json({ user: null });
    const { rows } = await query("SELECT id, nick, email FROM users WHERE id = $1", [req.userId]);
    res.json({ user: rows[0] ? publicUser(rows[0]) : null });
});

auth.post("/forgot", limit(5, 15), async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!emailPattern.test(email)) return res.status(400).json({ error: "Podaj poprawny e-mail." });

    const { rows } = await query("SELECT id, nick, email FROM users WHERE LOWER(email) = $1", [email]);
    if (rows.length) {
        const { token, hash } = newToken();
        await query("INSERT INTO password_resets (user_id, token_hash) VALUES ($1, $2)", [rows[0].id, hash]);
        await sendResetMail(rows[0].email, rows[0].nick, `${config.appUrl}/?reset=${token}`).catch((err) => console.error(err));
    }
    res.json({ message: `Jeśli konto z adresem ${email} istnieje, za chwilę przyjdzie link do zmiany hasła.` });
});

auth.post("/reset", limit(10, 15), async (req, res) => {
    const password = String(req.body.password || "");
    if (password.length < 8) return res.status(400).json({ error: "Hasło musi mieć co najmniej 8 znaków." });

    const { rows } = await query(
        `UPDATE password_resets SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id`,
        [hashToken(req.body.token)],
    );
    if (!rows.length) return res.status(400).json({ error: "Link wygasł albo był już użyty. Poproś o nowy." });

    await query(
        "UPDATE users SET password_hash = $1, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $2",
        [await bcrypt.hash(password, 10), rows[0].user_id],
    );
    res.json({ message: "Hasło zmienione. Możesz się zalogować." });
});
