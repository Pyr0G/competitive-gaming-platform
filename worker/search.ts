import { Hono } from "hono";
import { z } from "zod";
import type { SearchResponse } from "../shared/contracts";
import {
  decodeCursor,
  encodeCursor,
  fail,
  parseSearchQuery,
  requestKey,
  throttle,
  toPlayer,
  type AppEnv,
  type UserRow,
} from "./core";
import { listTeams } from "./teams";

const playerCursorSchema = z
  .object({ key: z.string().max(256), id: z.uuid() })
  .strict();
const categorySchema = z.enum(["overview", "players", "teams"]);

async function searchPlayers(
  db: D1Database,
  query: string,
  encodedCursor?: string,
): Promise<Pick<SearchResponse, "players" | "nextCursor">> {
  const cursor = decodeCursor(encodedCursor, playerCursorSchema);
  const result = cursor
    ? await db
        .prepare(
          "SELECT id, username, username_key, bio, created_at FROM users WHERE banned_at IS NULL AND instr(username_key, ?) > 0 AND (username_key > ? OR (username_key = ? AND id > ?)) ORDER BY username_key, id LIMIT 21",
        )
        .bind(query, cursor.key, cursor.key, cursor.id)
        .all<UserRow>()
    : await db
        .prepare(
          "SELECT id, username, username_key, bio, created_at FROM users WHERE banned_at IS NULL AND instr(username_key, ?) > 0 ORDER BY username_key, id LIMIT 21",
        )
        .bind(query)
        .all<UserRow>();
  const players = result.results.slice(0, 20);
  const last = players.at(-1);
  return {
    players: players.map(toPlayer),
    nextCursor:
      result.results.length > 20 && last
        ? encodeCursor({ key: last.username_key, id: last.id })
        : null,
  };
}

export const searchRouter = new Hono<AppEnv>();

searchRouter.get("/search", async (c) => {
  await throttle(c, `search:${c.get("account")?.id ?? requestKey(c)}`, 60, 60);
  const query = parseSearchQuery(c.req.query("q") ?? "");
  const cursor = c.req.query("cursor");
  const category = categorySchema.safeParse(
    c.req.query("category") ?? (cursor ? "players" : "overview"),
  );
  if (!category.success || (category.data === "overview" && cursor))
    fail(400, "INVALID_INPUT");
  const [playerPage, teamPage] = await Promise.all([
    category.data === "teams"
      ? { players: [], nextCursor: null }
      : searchPlayers(c.env.DB, query, cursor),
    category.data === "players"
      ? { teams: [], nextCursor: null }
      : listTeams(c.env.DB, query, cursor),
  ]);
  const response: SearchResponse = {
    ...playerPage,
    teams: teamPage.teams,
    nextTeamCursor: teamPage.nextCursor,
    categories: [
      { type: "players", available: true },
      { type: "teams", available: true },
      { type: "tournaments", available: false },
    ],
  };
  return c.json(response);
});
