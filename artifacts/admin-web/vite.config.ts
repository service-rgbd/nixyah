import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.PORT ?? "4173");
const basePath = process.env.BASE_PATH ?? "/";
const apiProxyTarget = (process.env.VITE_API_PROXY_TARGET ?? process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3333").trim();

export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: apiProxyTarget.startsWith("https://"),
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});