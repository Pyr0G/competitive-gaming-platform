import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { config } from "./config.js";

const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);

export const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: local ? false : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX) || 5,
});

export const query = (text, params) => pool.query(text, params);

const sqlFile = (name) => fs.readFile(path.join(import.meta.dirname, "..", "database", name), "utf8");

export const loadSchemaAndSeed = async () => {
    await pool.query(await sqlFile("schema.sql"));
    await pool.query(await sqlFile("seed.sql"));
};

export const initDatabase = async () => {
    const { rows } = await query("SELECT to_regclass('public.users') AS users");
    if (rows[0].users) return false;
    await loadSchemaAndSeed();
    return true;
};
