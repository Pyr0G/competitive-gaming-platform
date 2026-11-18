import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { config } from "./config.js";
import { databaseOptions } from "./database-options.js";

export const pool = new pg.Pool({
    ...databaseOptions(config.databaseUrl),
    max: Number(process.env.PG_POOL_MAX) || 5,
});

export const query = (text, params) => pool.query(text, params);

export const transaction = async (handler) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await handler(client.query.bind(client));
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
};

const sqlFile = (name) => fs.readFile(path.join(import.meta.dirname, "..", "database", name), "utf8");

export const loadSchemaAndSeed = async () => {
    if (config.production) throw new Error("Dane demo nie mogą być ładowane w produkcji.");
    await pool.query(await sqlFile("schema.sql"));
    await pool.query(await sqlFile("seed.sql"));
};

export const initDatabase = async () => {
    const { rows } = await query("SELECT to_regclass('public.users') AS users");
    if (rows[0].users) return false;
    if (!config.autoInitDatabase) throw new Error("Brak tabel w bazie. Najpierw uruchom inicjalizację bazy jako jej właściciel.");
    await loadSchemaAndSeed();
    return true;
};
