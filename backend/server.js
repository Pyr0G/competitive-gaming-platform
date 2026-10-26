import path from "node:path";
import express from "express";
import { config } from "./config.js";
import { initDatabase } from "./db.js";
import { auth, readSession } from "./auth.js";
import { api } from "./api.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(readSession);

app.use("/api/auth", auth);
app.use("/api", api);

app.use("/api", (req, res) => res.status(404).json({ error: "Nie ma takiego adresu w API." }));

app.use(express.static(path.join(import.meta.dirname, "..", "frontend"), { maxAge: config.production ? "1h" : 0 }));

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Coś poszło nie tak po stronie serwera." });
});

const created = await initDatabase();
if (created) console.log("Baza była pusta, założyłem tabele i wrzuciłem dane przykładowe.");

app.listen(config.port, () => {
    console.log(`CGP działa na ${config.appUrl}`);
    if (!config.brevoKey) console.log("Brak BREVO_API_KEY, maile lądują w logach zamiast w skrzynce.");
});
