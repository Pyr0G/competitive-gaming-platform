export const createRateLimiter = ({ maxEntries = 10000, now = Date.now } = {}) => {
    const hits = new Map();
    let nextCleanup = 0;

    return (operation, max, minutes) => (req, res, next) => {
        const time = now();
        if (time >= nextCleanup) {
            for (const [key, entry] of hits) {
                if (entry.reset <= time) hits.delete(key);
            }
            nextCleanup = time + 60000;
        }

        const key = JSON.stringify([operation, req.ip]);
        let entry = hits.get(key);
        if (entry && entry.reset <= time) {
            hits.delete(key);
            entry = null;
        }
        if (!entry) {
            if (hits.size >= maxEntries) {
                res.set("Retry-After", "60");
                return res.status(503).json({ error: "Serwer ma teraz za dużo zgłoszeń. Spróbuj za chwilę." });
            }
            entry = { count: 0, reset: time + minutes * 60000 };
            hits.set(key, entry);
        }
        if (entry.count >= max) {
            res.set("Retry-After", String(Math.max(1, Math.ceil((entry.reset - time) / 1000))));
            return res.status(429).json({ error: "Za dużo prób. Odczekaj chwilę i spróbuj znowu." });
        }
        entry.count++;
        next();
    };
};

export const createWorkLimiter = (maxConcurrent = 2) => {
    let active = 0;

    return (handler) => async (req, res, next) => {
        if (active >= maxConcurrent) {
            res.set("Retry-After", "1");
            return res.status(503).json({ error: "Serwer jest teraz zajęty. Spróbuj za chwilę." });
        }
        active++;
        try {
            await handler(req, res, next);
        } finally {
            active--;
        }
    };
};

export const limit = createRateLimiter();
export const passwordWork = createWorkLimiter();
