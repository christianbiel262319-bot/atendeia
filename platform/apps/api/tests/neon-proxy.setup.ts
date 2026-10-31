import { vi } from "vitest";
// Replace only the transport factory; Prisma models, SQL and PostgreSQL are real.
vi.mock(
  "../src/infra/database/prisma.js",
  () => import("../scripts/test-support/neon-proxy-client.js"),
);
