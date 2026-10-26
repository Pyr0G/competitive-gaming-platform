import { pool, loadSchemaAndSeed } from "./db.js";

await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await loadSchemaAndSeed();
console.log("Baza wyczyszczona i założona od nowa z danymi przykładowymi.");
await pool.end();
