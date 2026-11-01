export const createTypingStore = ({ maxEntries = 10000, now = Date.now } = {}) => {
    const entries = new Map();

    const cleanup = () => {
        const time = now();
        for (const [key, expires] of entries) {
            if (expires <= time) entries.delete(key);
        }
        return time;
    };

    return {
        set(key) {
            const time = cleanup();
            if (!entries.has(key) && entries.size >= maxEntries) return false;
            entries.set(key, time + 2500);
            return true;
        },
        has(key) {
            cleanup();
            return entries.has(key);
        },
        delete(key) {
            entries.delete(key);
        },
    };
};
