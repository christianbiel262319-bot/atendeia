export type ApiErrorPayload = {
  error?: { code?: string; message?: string; details?: unknown };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let tenantId: string | null = null;
let refreshPromise: Promise<void> | null = null;

export function setApiSession(session: { accessToken: string; tenantId: string } | null): void {
  accessToken = session?.accessToken ?? null;
  tenantId = session?.tenantId ?? null;
}

export function getRealtimeCredential(): string | null {
  return accessToken ? `token.${accessToken}` : null;
}

export async function restoreApiSession(): Promise<string> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  await refreshPromise;
  if (!accessToken) throw new ApiError(401, "SESSION_EXPIRED", "Sessão expirada");
  return accessToken;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { authenticated?: boolean; csrf?: boolean; _retried?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (init.authenticated) {
    if (!accessToken || !tenantId) throw new ApiError(401, "NO_SESSION", "Sessão não iniciada");
    headers.set("authorization", `Bearer ${accessToken}`);
    headers.set("x-tenant-id", tenantId);
  }
  if (init.csrf) {
    const csrfToken = readCookie("atendeia.csrf");
    if (!csrfToken) throw new ApiError(403, "CSRF_MISSING", "Proteção da sessão indisponível");
    headers.set("x-csrf-token", csrfToken);
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && init.authenticated && !init._retried) {
    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
      return apiRequest<T>(path, { ...init, _retried: true });
    } catch {
      setApiSession(null);
    }
  }
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error?.code ?? "REQUEST_FAILED",
      payload.error?.message ?? "Não foi possível concluir a solicitação",
      payload.error?.details,
    );
  }
  return payload;
}

async function refreshAccessToken(): Promise<void> {
  const csrfToken = readCookie("atendeia.csrf");
  if (!csrfToken) throw new ApiError(401, "SESSION_EXPIRED", "Sessão expirada");
  const response = await fetch("/v1/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: { accept: "application/json", "x-csrf-token": csrfToken },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: { session?: { accessToken?: string } };
  } & ApiErrorPayload;
  const nextToken = payload.data?.session?.accessToken;
  if (!response.ok || !nextToken) {
    throw new ApiError(
      response.status,
      payload.error?.code ?? "SESSION_EXPIRED",
      payload.error?.message ?? "Sessão expirada",
    );
  }
  const claims = decodeAccessToken(nextToken);
  setApiSession({ accessToken: nextToken, tenantId: claims.tenantId });
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

export function decodeAccessToken(token: string): { sub: string; tenantId: string; role: string } {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) throw new Error("missing payload");
    const normalized = encoded.replace(/-/gu, "+").replace(/_/gu, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as {
      sub: string;
      tenantId: string;
      role: string;
    };
  } catch {
    throw new ApiError(401, "INVALID_SESSION", "Sessão inválida");
  }
}
