import { registerHooks } from "node:module";

if (
  process.env.ATENDEIA_TEST_NEON_WS !== "true" ||
  process.env.NODE_ENV !== "test" ||
  process.env.ATENDEIA_DEPLOYMENT_STAGE !== "homologation"
) {
  throw new Error("This preload is restricted to explicit isolated Neon tests");
}
const original = new URL("../../src/infra/database/prisma.ts", import.meta.url)
  .href;
const replacement = new URL("./neon-proxy-client.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    return result.url === original ? { ...result, url: replacement } : result;
  },
});
