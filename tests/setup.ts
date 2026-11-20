import { beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations, reset } from "cloudflare:test";

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
