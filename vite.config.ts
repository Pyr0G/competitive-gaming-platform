import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    cloudflare({
      configPath: "wrangler.local.jsonc",
      remoteBindings: false,
      ...(mode === "e2e" ? { persistState: { path: ".wrangler/e2e" } } : {}),
    }),
  ],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
}));
