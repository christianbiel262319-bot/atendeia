import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { verifyAccessToken } from "../../core/security/jwt.js";
import { prisma } from "../database/prisma.js";

type TenantSocket = WebSocket & { tenantId?: string; userId?: string; tokenExpiresAt?: number };

export function attachWebSocketServer(server: HttpServer): WebSocketServer {
  const websocketServer = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => protocols.has("atendeia.realtime") ? "atendeia.realtime" : false,
  });

  server.on("upgrade", (request, socket, head) => {
    void authorizeUpgrade(websocketServer, request, socket, head);
  });

  websocketServer.on("connection", (socket: TenantSocket) => {
    socket.send(JSON.stringify({ type: "connected", tenantId: socket.tenantId }));
    const remainingMs = Math.max(0, (socket.tokenExpiresAt ?? 0) - Date.now());
    const expirationTimer = setTimeout(() => socket.close(4001, "TOKEN_EXPIRED"), remainingMs);
    socket.once("close", () => clearTimeout(expirationTimer));
    socket.on("message", () => {
      socket.send(JSON.stringify({ type: "error", code: "CLIENT_MESSAGES_NOT_SUPPORTED" }));
    });
  });

  websocketServer.on("error", (error) => {
    logger.error({ error }, "WebSocket server error");
  });
  return websocketServer;
}

async function authorizeUpgrade(
  websocketServer: WebSocketServer,
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/realtime" || request.headers.origin !== env.APP_ORIGIN) {
      return rejectUpgrade(socket, 403);
    }

    const protocols = String(request.headers["sec-websocket-protocol"] ?? "")
      .split(",")
      .map((value) => value.trim());
    const credential = protocols.find((value) => value.startsWith("token."));
    if (!credential) return rejectUpgrade(socket, 401);

    const payload = verifyAccessToken(credential.slice("token.".length));
    const membership = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: payload.tenantId, userId: payload.sub } },
      select: { active: true, tenant: { select: { status: true } } },
    });
    if (!membership?.active || membership.tenant.status !== "ACTIVE") return rejectUpgrade(socket, 403);

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      const tenantSocket = websocket as TenantSocket;
      tenantSocket.tenantId = payload.tenantId;
      tenantSocket.userId = payload.sub;
      tenantSocket.tokenExpiresAt = payload.exp * 1_000;
      websocketServer.emit("connection", tenantSocket, request);
    });
  } catch {
    rejectUpgrade(socket, 401);
  }
}

function rejectUpgrade(socket: Duplex, statusCode: number): void {
  socket.write(`HTTP/1.1 ${statusCode} Unauthorized\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function broadcastToTenant(
  websocketServer: WebSocketServer,
  tenantId: string,
  event: unknown,
): void {
  const payload = JSON.stringify(event);
  for (const client of websocketServer.clients) {
    const tenantClient = client as TenantSocket;
    if (tenantClient.readyState === WebSocket.OPEN && tenantClient.tenantId === tenantId) {
      tenantClient.send(payload);
    }
  }
}
