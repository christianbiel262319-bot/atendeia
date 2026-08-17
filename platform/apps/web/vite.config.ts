import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/v1": { target: "http://localhost:4000", changeOrigin: false },
      "/health": { target: "http://localhost:4000", changeOrigin: false },
      "/realtime": { target: "ws://localhost:4000", ws: true },
    },
  },
});
