import { failure, translateRequest } from "./i18n.js";
import path from "node:path";
import express from "express";
import { config } from "./config.js";
import { initDatabase } from "./db.js";
import { auth, readSession } from "./auth.js";
import { api } from "./api.js";
import { chat } from "./chat.js";
import { admin } from "./admin.js";
import { apiRateLimit } from "./api-rate-limit.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use("/api", (req, res, next) => {
    res.set("Content-Language", translateRequest(req).language);
    res.vary("Accept-Language");
    res.vary("X-CGP-Language");
    res.vary("X-CGP-Region");
    next();
});
app.use("/api", apiRateLimit);
app.use(express.json({ limit: "20kb" }));
app.use("/api", readSession);

app.use("/api/auth", auth);
app.use("/api/chat", chat);
app.use("/api/admin", admin);
app.use("/api", api);

app.use("/api", (req, res) => res.status(404).json(failure(req, "error.apiMissing")));

app.use(express.static(path.join(import.meta.dirname, "..", "frontend"), {
    maxAge: config.production ? "1h" : 0,
    setHeaders: (res, file) => {
        if (/\.(?:html|js|css)$/.test(file)) res.set("Cache-Control", "no-cache");
    },
}));

app.use((err, req, res, next) => {
    console.error(err);
    const status = err.type === "entity.too.large" ? 413 : err.type === "entity.parse.failed" ? 400 : 500;
    res.status(status).json(failure(req, status === 413 ? "error.bodyTooLarge" : status === 400 ? "error.badRequest" : "error.server"));
});

const created = await initDatabase();
if (created) console.log("Baza była pusta, założyłem tabele i wrzuciłem dane przykładowe.");

app.listen(config.port, () => {
    console.log(`CGP działa na ${config.appUrl}`);
    if (!config.brevoKey) console.log("Brak BREVO_API_KEY, maile lądują w logach zamiast w skrzynce.");
});
