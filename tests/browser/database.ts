import { execFileSync } from "node:child_process";

export function database(...args: string[]) {
  return execFileSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "d1",
      ...args,
      "--local",
      "--config",
      "wrangler.local.jsonc",
      "--persist-to",
      ".wrangler/e2e",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
}

export function sql(statement: string) {
  return database("execute", "cgp-local", "--command", statement);
}
