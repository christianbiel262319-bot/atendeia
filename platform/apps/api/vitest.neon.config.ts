import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts", "./tests/neon-proxy.setup.ts"],
    include: [
      "tests/postgresql-homologation.integration.test.ts",
      "tests/media-cleanup-postgresql.integration.test.ts",
    ],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 60_000,
  },
});
