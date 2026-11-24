import { Buffer } from "node:buffer";
import { Hono } from "hono";
import { z } from "zod";
import type {
  TeamDetails,
  TeamMember,
  TeamSummary,
  TeamsResponse,
} from "../shared/contracts";
import {
  csrfGuard,
  fail,
  newId,
  readJson,
  requireAuth,
  throttle,
  type AppEnv,
} from "./core";

interface TeamRow {
  id: string;
  name: string;
  tag: string;
  captain_id: string;
  captain_username: string;
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
const cursorSchema = z.object({ createdAt: z.string(), id: z.uuid() }).strict();

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

teamsRouter.get("/teams", async (c) => {
  await throttle(c, `teams:${c.get("account")?.id ?? "public"}`, 60, 60);
  let cursor: z.infer<typeof cursorSchema> | null = null;
  const encoded = c.req.query("cursor");
  if (encoded) {
    try {
      if (encoded.length > 1024 || !/^[a-zA-Z0-9_-]+$/.test(encoded))
        fail(400, "INVALID_INPUT");
      const result = cursorSchema.safeParse(
        JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
      );
      if (!result.success) fail(400, "INVALID_INPUT");
      cursor = result.data;
    } catch {
      fail(400, "INVALID_INPUT");
    }
  }
  const result = cursor
    ? await c.env.DB.prepare(
        `SELECT teams.id, teams.name, teams.tag, teams.captain_id, captain.username AS captain_username,
          (SELECT COUNT(*) FROM team_members WHERE team_id = teams.id) AS member_count, teams.created_at
         FROM teams INNER JOIN users AS captain ON captain.id = teams.captain_id
         WHERE teams.created_at < ? OR (teams.created_at = ? AND teams.id < ?)
         ORDER BY teams.created_at DESC, teams.id DESC LIMIT 21`,
      )
        .bind(cursor.createdAt, cursor.createdAt, cursor.id)
        .all<TeamRow>()
    : await c.env.DB.prepare(
        `SELECT teams.id, teams.name, teams.tag, teams.captain_id, captain.username AS captain_username,
          (SELECT COUNT(*) FROM team_members WHERE team_id = teams.id) AS member_count, teams.created_at
         FROM teams INNER JOIN users AS captain ON captain.id = teams.captain_id
         ORDER BY teams.created_at DESC, teams.id DESC LIMIT 21`,
      ).all<TeamRow>();
  const teams = result.results.slice(0, 20).map(toTeam);
  const last = teams.at(-1);
  const response: TeamsResponse = {
    teams,
    nextCursor:
      result.results.length > 20 && last
        ? Buffer.from(
            JSON.stringify({ createdAt: last.createdAt, id: last.id }),
          ).toString("base64url")
        : null,
  };
  return c.json(response);
});

teamsRouter.get("/teams/:id", async (c) => {
  await throttle(c, `teams:one:${c.get("account")?.id ?? "public"}`, 60, 60);
  const parsed = z.uuid().safeParse(c.req.param("id"));
  if (!parsed.success) fail(404, "NOT_FOUND");
  const team = await c.env.DB.prepare(
    `SELECT teams.id, teams.name, teams.tag, teams.captain_id, captain.username AS captain_username,
      (SELECT COUNT(*) FROM team_members WHERE team_id = teams.id) AS member_count, teams.created_at
     FROM teams INNER JOIN users AS captain ON captain.id = teams.captain_id
     WHERE teams.id = ?`,
  )
    .bind(parsed.data)
    .first<TeamRow>();
  if (!team) fail(404, "NOT_FOUND");
  const members = await c.env.DB.prepare(
    `SELECT users.id, users.username, team_members.role, team_members.joined_at
     FROM team_members INNER JOIN users ON users.id = team_members.user_id
     WHERE team_members.team_id = ?
     ORDER BY CASE team_members.role WHEN 'captain' THEN 0 ELSE 1 END, users.username_key`,
  )
    .bind(parsed.data)
    .all<MemberRow>();
  const response: { team: TeamDetails } = {
    team: {
      ...toTeam(team),
      members: members.results.map((member): TeamMember => ({
        id: member.id,
        username: member.username,
        role: member.role,
        joinedAt: member.joined_at,
      })),
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
        "INSERT INTO teams (id, name, name_key, tag, tag_key, captain_id) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(
        id,
        body.name,
        body.name.toLowerCase(),
        body.tag,
        body.tag.toLowerCase(),
        account.id,
      ),
      c.env.DB.prepare(
        "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'captain')",
      ).bind(id, account.id),
    ]);
    if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1)
      fail(500, "INTERNAL_ERROR");
  } catch (error) {
    if (uniqueConflict(error)) fail(409, "TEAM_UNAVAILABLE");
    throw error;
  }
  const team = await c.env.DB.prepare(
    `SELECT teams.id, teams.name, teams.tag, teams.captain_id, captain.username AS captain_username,
      (SELECT COUNT(*) FROM team_members WHERE team_id = teams.id) AS member_count, teams.created_at
     FROM teams INNER JOIN users AS captain ON captain.id = teams.captain_id
     WHERE teams.id = ?`,
  )
    .bind(id)
    .first<TeamRow>();
  if (!team) fail(500, "INTERNAL_ERROR");
  return c.json({ team: toTeam(team) }, 201);
});
