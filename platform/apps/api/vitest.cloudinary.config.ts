import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts", "./tests/neon-proxy.setup.ts"],
    include: ["tests/cloudinary-live.postgresql.integration.test.ts"],
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 180000,
  },
});
