import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query, transaction } from "./db.js";
import { config } from "./config.js";
import { sendVerifyMail, sendResetMail } from "./mail.js";
import { limit, passwordWork } from "./resource-limits.js";

export { limit };

export const auth = Router();

const COOKIE = "cgp_session";
const validEmail = (email) => {
    if (email.length > 254 || /\s/.test(email)) return false;
    const at = email.indexOf("@");
    const dot = email.indexOf(".", at + 2);
    return at > 0 && at === email.lastIndexOf("@") && dot > at + 1 && dot < email.length - 1;
};
const nickPattern = /^[\p{L}\p{N}_.-]{3,32}$/u;

const newToken = () => {
    const token = crypto.randomBytes(32).toString("hex");
    return { token, hash: hashToken(token) };
};

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

const publicUser = (u) => ({ id: Number(u.id), nick: u.nick, email: u.email, admin: Boolean(u.is_admin) });

const sessionKey = (passwordHash) => crypto.createHmac("sha256", config.jwtSecret).update(`cgp-session:${passwordHash}`).digest("hex");

export const readSession = async (req, res, next) => {
    req.userId = null;
    const cookie = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
    if (!cookie) return next();
    let session;
    try {
        session = jwt.verify(decodeURIComponent(cookie.slice(COOKIE.length + 1)), config.jwtSecret);
    } catch {
        return next();
    }
    if (!Number.isSafeInteger(session.id) || session.id <= 0 || typeof session.auth !== "string" || !/^[a-f0-9]{64}$/.test(session.auth)) return next();
    const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [session.id]);
    if (rows.length && crypto.timingSafeEqual(Buffer.from(session.auth, "hex"), Buffer.from(sessionKey(rows[0].password_hash), "hex"))) req.userId = session.id;
    next();
};

export const requireUser = async (req, res, next) => {
    if (!req.userId) return res.status(401).json({ error: "Zaloguj się, żeby to zrobić." });
    const { rows } = await query("SELECT is_admin, banned_at FROM users WHERE id = $1", [req.userId]);
    if (!rows.length) return res.status(401).json({ error: "Zaloguj się, żeby to zrobić." });
    if (rows[0].banned_at) return res.status(403).json({ error: "To konto zostało zablokowane." });
    req.isAdmin = rows[0].is_admin;
    next();
};

export const requireAdmin = (req, res, next) => requireUser(req, res, () => {
    if (!req.isAdmin) return res.status(403).json({ error: "Tylko dla administratorów." });
    next();
});

const setSession = (res, user) => {
    res.cookie(COOKIE, jwt.sign({ id: Number(user.id), auth: sessionKey(user.password_hash) }, config.jwtSecret, { expiresIn: "7d" }), {
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

auth.post("/register", limit("register", 10, 15), passwordWork(async (req, res) => {
    const nick = String(req.body.nick || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!nickPattern.test(nick)) return res.status(400).json({ error: "Nick musi mieć od 3 do 32 znaków: litery, cyfry oraz _ . -" });
    if (!validEmail(email)) return res.status(400).json({ error: "Podaj poprawny e-mail." });
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
}));

auth.get("/verify", async (req, res) => {
    const tokenHash = hashToken(req.query.token);
    const user = await transaction(async (run) => {
        const { rows: owners } = await run(
            `SELECT u.id FROM users u JOIN email_verifications v ON v.user_id = u.id
             WHERE v.token_hash = $1 AND v.used_at IS NULL AND v.expires_at > NOW()
             FOR UPDATE OF u`,
            [tokenHash],
        );
        if (!owners.length) return null;
        const { rows } = await run(
            `UPDATE email_verifications SET used_at = NOW()
             WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
             RETURNING user_id`,
            [tokenHash],
        );
        if (!rows.length) return null;
        const { rows: users } = await run("UPDATE users SET email_verified_at = NOW() WHERE id = $1 RETURNING id, password_hash", [owners[0].id]);
        return users[0] || null;
    });
    if (!user) return res.redirect("/?verified=0");
    setSession(res, user);
    res.redirect("/?verified=1");
});

auth.post("/resend", limit("resend", 5, 15), async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const { rows } = await query("SELECT id, nick, email FROM users WHERE LOWER(email) = $1 AND email_verified_at IS NULL", [email]);
    if (rows.length) await createVerification(rows[0]).catch((err) => console.error(err));
    res.json({ message: "Jeśli to konto czeka na aktywację, wysłaliśmy nowy link." });
});

auth.post("/login", limit("login", 20, 15), passwordWork(async (req, res) => {
    const login = String(req.body.login || "").trim();
    const password = String(req.body.password || "");
    if (!login || !password) return res.status(400).json({ error: "Wpisz nick albo e-mail i hasło." });

    const { rows } = await query(
        "SELECT id, nick, email, password_hash, email_verified_at, is_admin, banned_at FROM users WHERE LOWER(nick) = LOWER($1) OR LOWER(email) = LOWER($1)",
        [login],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: "Zły nick, e-mail albo hasło." });
    }
    if (user.banned_at) return res.status(403).json({ error: "To konto zostało zablokowane przez administratora." });
    if (!user.email_verified_at) {
        return res.status(403).json({ error: "Najpierw potwierdź maila. Link jest w skrzynce (zajrzyj też do spamu).", unverified: user.email });
    }

    setSession(res, user);
    res.json({ user: publicUser(user) });
}));

auth.post("/logout", (req, res) => {
    res.clearCookie(COOKIE);
    res.json({ message: "Wylogowano." });
});

auth.get("/me", async (req, res) => {
    if (!req.userId) return res.json({ user: null });
    const { rows } = await query(
        `SELECT u.id, u.nick, u.email, u.is_admin, u.banned_at, t.name AS team_name, t.tag AS team_tag
         FROM users u LEFT JOIN teams t ON t.captain_id = u.id WHERE u.id = $1 LIMIT 1`,
        [req.userId],
    );
    const u = rows[0];
    if (!u || u.banned_at) {
        res.clearCookie(COOKIE);
        return res.json({ user: null });
    }
    res.json({ user: { ...publicUser(u), team: u.team_tag ? { name: u.team_name, tag: u.team_tag } : null } });
});

auth.post("/forgot", limit("forgot", 5, 15), async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ error: "Podaj poprawny e-mail." });

    const { rows } = await query("SELECT id, nick, email FROM users WHERE LOWER(email) = $1", [email]);
    if (rows.length) {
        const { token, hash } = newToken();
        await query("INSERT INTO password_resets (user_id, token_hash) VALUES ($1, $2)", [rows[0].id, hash]);
        await sendResetMail(rows[0].email, rows[0].nick, `${config.appUrl}/?reset=${token}`).catch((err) => console.error(err));
    }
    res.json({ message: `Jeśli konto z adresem ${email} istnieje, za chwilę przyjdzie link do zmiany hasła.` });
});

auth.post("/reset", limit("reset", 10, 15), passwordWork(async (req, res) => {
    const password = String(req.body.password || "");
    if (password.length < 8) return res.status(400).json({ error: "Hasło musi mieć co najmniej 8 znaków." });

    const tokenHash = hashToken(req.body.token);
    const passwordHash = await bcrypt.hash(password, 10);
    const changed = await transaction(async (run) => {
        const { rows: users } = await run(
            `SELECT u.id FROM users u JOIN password_resets r ON r.user_id = u.id
             WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > NOW()
             FOR UPDATE OF u`,
            [tokenHash],
        );
        if (!users.length) return false;
        const { rows } = await run(
            `UPDATE password_resets SET used_at = NOW()
             WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
             RETURNING user_id`,
            [tokenHash],
        );
        if (!rows.length) return false;
        await run(
            "UPDATE users SET password_hash = $1, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $2",
            [passwordHash, users[0].id],
        );
        await run("UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [users[0].id]);
        await run("UPDATE email_verifications SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [users[0].id]);
        return true;
    });
    if (!changed) return res.status(400).json({ error: "Link wygasł albo był już użyty. Poproś o nowy." });
    res.json({ message: "Hasło zmienione. Możesz się zalogować." });
}));
