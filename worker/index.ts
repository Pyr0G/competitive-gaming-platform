import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import { originGuard, securityHeaders, sessionMiddleware } from "./core";
import type { AppEnv } from "./core";
import { postsRouter } from "./posts";
import { socialRouter } from "./social";
import { teamsRouter } from "./teams";

export { PasswordHasher } from "./passwords";

const app = new Hono<AppEnv>();

app.use("*", securityHeaders);
app.use("/api/*", originGuard);
app.use("/api/*", sessionMiddleware);

app.get("/api/health", async (c) => {
  await c.env.DB.prepare("SELECT id FROM users LIMIT 1").first();
  return c.json({ status: "ok" });
});

app.route("/api", authRouter);
app.route("/api", socialRouter);
app.route("/api", postsRouter);
app.route("/api", teamsRouter);
app.route("/api", adminRouter);

app.all("*", async (c) => {
  if (c.req.path === "/api" || c.req.path.startsWith("/api/"))
    return c.json({ error: { code: "NOT_FOUND" } }, 404);
  if (!["GET", "HEAD"].includes(c.req.method))
    return c.json({ error: { code: "NOT_FOUND" } }, 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((error, c) => {
  c.header("Cache-Control", "no-store");
  if (error instanceof HTTPException)
    return c.json({ error: { code: error.message } }, error.status);
  return c.json({ error: { code: "INTERNAL_ERROR" } }, 500);
});

export default app;
