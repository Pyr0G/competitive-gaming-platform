import { pool, loadSchemaAndSeed } from "./db.js";
import { config } from "./config.js";

if (config.production) throw new Error("Reset bazy jest dostępny tylko poza produkcją.");

await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await loadSchemaAndSeed();
console.log("Baza wyczyszczona i założona od nowa z danymi przykładowymi.");
await pool.end();
