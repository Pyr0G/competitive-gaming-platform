import { Hono } from "hono";
import { html } from "hono/html";
import { HTTPException } from "hono/http-exception";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import {
  originGuard,
  runtimeSettings,
  securityHeaders,
  sessionMiddleware,
} from "./core";
import type { AppEnv } from "./core";
import { postsRouter } from "./posts";
import { searchRouter } from "./search";
import { socialRouter } from "./social";
import { teamsRouter } from "./teams";

export { PasswordHasher } from "./passwords";

const app = new Hono<AppEnv>();

app.use("*", securityHeaders);
app.use("/api/*", originGuard);
app.use("/api/*", sessionMiddleware);

app.get("/robots.txt", (c) => {
  const { origin } = runtimeSettings(c);
  return c.text(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get("/sitemap.xml", (c) => {
  const { origin } = runtimeSettings(c);
  const sitemap = html`<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>${origin}/</loc></url>
      <url><loc>${origin}/guide</loc></url>
    </urlset> `;
  return c.body(sitemap.toString(), 200, {
    "Content-Type": "application/xml; charset=UTF-8",
  });
});

app.get("/api/health", async (c) => {
  await c.env.DB.prepare("SELECT id FROM users LIMIT 1").first();
  return c.json({ status: "ok" });
});

app.route("/api", authRouter);
app.route("/api", searchRouter);
app.route("/api", socialRouter);
app.route("/api", postsRouter);
app.route("/api", teamsRouter);
app.route("/api", adminRouter);

app.all("*", async (c) => {
  if (c.req.path === "/api" || c.req.path.startsWith("/api/"))
    return c.json({ error: { code: "NOT_FOUND" } }, 404);
  if (!["GET", "HEAD"].includes(c.req.method))
    return c.json({ error: { code: "NOT_FOUND" } }, 404);
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (!/^\/login\/*$/i.test(c.req.path)) return asset;

  const response = new Response(asset.body, asset);
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
});

app.onError((error, c) => {
  c.header("Cache-Control", "no-store");
  if (error instanceof HTTPException)
    return c.json({ error: { code: error.message } }, error.status);
  return c.json({ error: { code: "INTERNAL_ERROR" } }, 500);
});

export default app;
