import { database, sql } from "./database";

export default function setup() {
  database("migrations", "apply", "cgp-local");
  sql(
    "DELETE FROM team_members; DELETE FROM teams; DELETE FROM posts; DELETE FROM admin_actions; DELETE FROM reports; DELETE FROM conversation_reads; DELETE FROM messages; DELETE FROM conversations; DELETE FROM blocks; DELETE FROM sessions; DELETE FROM users; DELETE FROM rate_limits;",
  );
}
