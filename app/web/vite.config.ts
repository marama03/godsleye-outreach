import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = process.env.PORT ?? "8787";

export default defineConfig({
  root,
  plugins: [react()],
  css: { postcss: path.join(root, "postcss.config.cjs") },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: false } },
  },
  build: { outDir: path.join(root, "dist"), emptyOutDir: true },
});
