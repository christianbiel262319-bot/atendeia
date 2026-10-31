// Test-only transport. Production continues using PrismaPg from src/infra/database/prisma.ts.
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { HttpsProxyAgent } from "https-proxy-agent";
import WebSocket from "ws";
import { PrismaClient } from "../../src/generated/prisma/client.js";

const connectionString = process.env.ATENDEIA_ACCEPTANCE_DATABASE_URL;
if (
  !connectionString ||
  process.env.ATENDEIA_TEST_NEON_WS !== "true" ||
  process.env.NODE_ENV !== "test" ||
  process.env.ATENDEIA_DEPLOYMENT_STAGE !== "homologation"
) {
  throw new Error(
    "Neon proxy transport is restricted to explicit homologation tests",
  );
}
const target = new URL(connectionString);
if (
  target.hostname !== "ep-aged-sea-afmt0kin.c-2.us-west-2.aws.neon.tech" ||
  target.pathname !== "/atendeia_homologacao" ||
  process.env.ATENDEIA_TEST_BRANCH_ID !== "br-red-term-aft504d9"
) {
  throw new Error("Refusing a database outside the isolated Neon test branch");
}
const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
class TestWebSocket extends WebSocket {
  constructor(address: string, protocols?: string | string[]) {
    super(address, protocols, {
      ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
      handshakeTimeout: 20_000,
    });
  }
}
neonConfig.webSocketConstructor = TestWebSocket;
neonConfig.poolQueryViaFetch = false;
const adapter = new PrismaNeon({
  connectionString,
  max: 4,
  connectionTimeoutMillis: 20_000,
});
export const prisma = new PrismaClient({ adapter });
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
