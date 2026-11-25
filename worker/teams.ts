import { Hono } from "hono";
import { z } from "zod";
import type {
  TeamDetails,
  TeamMember,
  TeamSummary,
  TeamsResponse,
} from "../shared/contracts";
import {
  activeSessionSql,
  csrfGuard,
  decodeCursor,
  encodeCursor,
  fail,
  newId,
  parseSearchQuery,
  readJson,
  requestKey,
  requireAuth,
  throttle,
  type AppEnv,
} from "./core";

interface TeamRow {
  id: string;
  name: string;
  tag: string;
  captain_id: string | null;
  captain_username: string | null;
  member_count: number;
  created_at: string;
}

interface MemberRow {
  id: string;
  username: string;
  role: "captain" | "member";
  joined_at: string;
}

const nameSchema = z
  .string()
  .trim()
  .max(64)
  .transform((value) => value.normalize("NFKC"))
  .refine(
    (value) =>
      [...value].length >= 3 &&
      [...value].length <= 32 &&
      /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .'-]*$/u.test(value),
  );
const tagSchema = z
  .string()
  .trim()
  .max(16)
  .transform((value) => value.normalize("NFKC").toUpperCase())
  .refine((value) => /^[A-Z0-9]{2,5}$/.test(value));
const createSchema = z
  .object({
    name: nameSchema,
    tag: tagSchema,
  })
  .strict();
const cursorSchema = z
  .object({ createdAt: z.string().datetime({ precision: 3 }), id: z.uuid() })
  .strict();

const teamSql = `SELECT teams.id, teams.name, teams.tag, captain.id AS captain_id, captain.username AS captain_username,
  (SELECT COUNT(*) FROM team_members JOIN users AS roster_user ON roster_user.id = team_members.user_id
   WHERE team_members.team_id = teams.id AND roster_user.banned_at IS NULL) AS member_count, teams.created_at
  FROM teams LEFT JOIN users AS captain ON captain.id = teams.captain_id AND captain.banned_at IS NULL`;

export const teamsRouter = new Hono<AppEnv>();

function toTeam(row: TeamRow): TeamSummary {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    captainId: row.captain_id,
    captainUsername: row.captain_username,
    memberCount: row.member_count,
    createdAt: row.created_at,
  };
}

function uniqueConflict(error: unknown): boolean {
  return (
    error instanceof Error && /UNIQUE constraint failed/.test(error.message)
  );
}

export async function listTeams(
  db: D1Database,
  query: string,
  encodedCursor?: string,
): Promise<TeamsResponse> {
  const cursor = decodeCursor(encodedCursor, cursorSchema);
  const conditions: string[] = [];
  const bindings: string[] = [];
  if (query) {
    conditions.push(
      "(instr(teams.name_key, ?) > 0 OR instr(teams.tag_key, ?) > 0)",
    );
    bindings.push(query, query);
  }
  if (cursor) {
    conditions.push("(teams.created_at, teams.id) < (?, ?)");
    bindings.push(cursor.createdAt, cursor.id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const statement = db.prepare(
    `${teamSql} ${where} ORDER BY teams.created_at DESC, teams.id DESC LIMIT 21`,
  );
  const result = await (
    bindings.length ? statement.bind(...bindings) : statement
  ).all<TeamRow>();
  const teams = result.results.slice(0, 20).map(toTeam);
  const last = teams.at(-1);
  return {
    teams,
    nextCursor:
      result.results.length > 20 && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}

teamsRouter.get("/teams", async (c) => {
  await throttle(c, `teams:${c.get("account")?.id ?? requestKey(c)}`, 60, 60);
  const query = parseSearchQuery(c.req.query("q") ?? "", true);
  return c.json(await listTeams(c.env.DB, query, c.req.query("cursor")));
});

teamsRouter.get("/teams/:id", async (c) => {
  await throttle(
    c,
    `teams:one:${c.get("account")?.id ?? requestKey(c)}`,
    60,
    60,
  );
  const parsed = z.uuid().safeParse(c.req.param("id"));
  if (!parsed.success) fail(404, "NOT_FOUND");
  const [teamResult, memberResult] = await c.env.DB.batch<TeamRow | MemberRow>([
    c.env.DB.prepare(`${teamSql} WHERE teams.id = ?`).bind(parsed.data),
    c.env.DB.prepare(
      `SELECT users.id, users.username, team_members.role, team_members.joined_at
       FROM team_members INNER JOIN users ON users.id = team_members.user_id
       WHERE team_members.team_id = ? AND users.banned_at IS NULL
       ORDER BY CASE team_members.role WHEN 'captain' THEN 0 ELSE 1 END, users.username_key`,
    ).bind(parsed.data),
  ]);
  const team = teamResult.results[0] as TeamRow | undefined;
  if (!team) fail(404, "NOT_FOUND");
  const response: { team: TeamDetails } = {
    team: {
      ...toTeam(team),
      members: (memberResult.results as MemberRow[]).map(
        (member): TeamMember => ({
          id: member.id,
          username: member.username,
          role: member.role,
          joinedAt: member.joined_at,
        }),
      ),
    },
  };
  return c.json(response);
});

teamsRouter.post("/teams", requireAuth, csrfGuard, async (c) => {
  const account = c.get("account");
  await throttle(c, `teams:create:${account.id}`, 10, 3600);
  const body = await readJson(c, createSchema);
  const id = newId();
  try {
    const results = await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO teams (id, name, name_key, tag, tag_key, captain_id)
         SELECT ?, ?, ?, ?, ?, users.id ${activeSessionSql}`,
      ).bind(
        id,
        body.name,
        body.name.toLowerCase(),
        body.tag,
        body.tag.toLowerCase(),
        account.id,
        c.get("session").token_hash,
      ),
      c.env.DB.prepare(
        `INSERT INTO team_members (team_id, user_id, role)
         SELECT id, captain_id, 'captain' FROM teams WHERE id = ? AND changes() > 0`,
      ).bind(id),
    ]);
    if (results[0].meta.changes === 0) fail(401, "UNAUTHENTICATED");
    if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1)
      fail(500, "INTERNAL_ERROR");
  } catch (error) {
    if (uniqueConflict(error)) fail(409, "TEAM_UNAVAILABLE");
    throw error;
  }
  const team = await c.env.DB.prepare(`${teamSql} WHERE teams.id = ?`)
    .bind(id)
    .first<TeamRow>();
  if (!team) fail(500, "INTERNAL_ERROR");
  return c.json({ team: toTeam(team) }, 201);
});
