import { rateLimit } from "express-rate-limit";

export const createApiRateLimit = ({ maxEntries = 10000, now = Date.now, limit = 300, windowMs = 60000 } = {}) => {
    const hits = new Map();
    let nextCleanup = 0;
    const store = {
        localKeys: true,
        increment(key) {
            const time = now();
            if (time >= nextCleanup) {
                for (const [id, entry] of hits) {
                    if (entry.resetTime.getTime() <= time) hits.delete(id);
                }
                nextCleanup = time + windowMs;
            }
            let entry = hits.get(key);
            if (!entry || entry.resetTime.getTime() <= time) {
                if (!entry && hits.size >= maxEntries) return { totalHits: limit + 1, resetTime: new Date(time + windowMs) };
                entry = { totalHits: 0, resetTime: new Date(time + windowMs) };
                hits.set(key, entry);
            }
            entry.totalHits = Math.min(entry.totalHits + 1, limit + 1);
            return { ...entry };
        },
        decrement(key) {
            const entry = hits.get(key);
            if (entry) entry.totalHits = Math.max(0, entry.totalHits - 1);
        },
        resetKey(key) { hits.delete(key); },
    };
    return rateLimit({
        windowMs,
        limit,
        store,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: "Za dużo prób. Odczekaj chwilę i spróbuj znowu." },
    });
};

export const apiRateLimit = createApiRateLimit();
