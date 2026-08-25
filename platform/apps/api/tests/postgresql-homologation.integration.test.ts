import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { disconnectDatabase, prisma } from "../src/infra/database/prisma.js";

const enabled = process.env.ATENDEIA_RUN_POSTGRES_ACCEPTANCE === "true";
const suite = enabled ? describe : describe.skip;

type Session = {
  accessToken: string;
  csrfToken: string;
  tenantId: string;
  userId: string;
  cookies: string;
};

type ApiProcess = {
  child: ChildProcess;
  baseUrl: string;
};

suite("homologação real com PostgreSQL", () => {
  const suffix = randomUUID().slice(0, 8);
  const password = "Senha-Homologacao-2026!";
  const accountAEmail = `homologacao-a-${suffix}@example.test`;
  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];
  let api: ApiProcess;
  let baseUrl: string;

  beforeAll(async () => {
    api = await startApiProcess({ PLATFORM_OWNER_EMAIL: accountAEmail });
    baseUrl = api.baseUrl;
  });

  afterAll(async () => {
    if (api) await stopApiProcess(api);
    for (const tenantId of createdTenantIds) {
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
    for (const userId of createdUserIds) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await disconnectDatabase();
  });

  it("persiste cadastro, empresa e contato após logout e reinício, isolando dois tenants", async () => {
    const accountA = await register({
      companyName: `Empresa Persistência A ${suffix}`,
      fullName: "Usuário Homologação A",
      email: accountAEmail,
      password,
    });
    createdTenantIds.push(accountA.tenantId);
    createdUserIds.push(accountA.userId);

    const companyUpdate = await request("/v1/tenant/profile", {
      method: "PATCH",
      session: accountA,
      body: { name: `Empresa Persistida A ${suffix}`, timezone: "America/Sao_Paulo" },
    });
    expect(companyUpdate.status).toBe(200);

    const contactAResponse = await request("/v1/crm/contacts", {
      method: "POST",
      session: accountA,
      body: {
        displayName: "Cliente Teste Persistência",
        phoneE164: `+55119${suffix.replace(/\D/gu, "").padEnd(7, "0").slice(0, 7)}`,
        email: `cliente-a-${suffix}@example.test`,
        tags: ["homologação"],
      },
    });
    expect(contactAResponse.status).toBe(201);
    const contactA = await jsonData<{ id: string }>(contactAResponse);

    const productAResponse = await request("/v1/knowledge/products", {
      method: "POST",
      session: accountA,
      body: { name: `Produto A ${suffix}`, description: "Produto persistente A" },
    });
    expect(productAResponse.status).toBe(201);
    const productA = await jsonData<{ id: string }>(productAResponse);

    const aiAResponse = await request("/v1/ai/configuration", {
      method: "PUT",
      session: accountA,
      body: aiConfiguration(`tom exclusivo A ${suffix}`),
    });
    expect(aiAResponse.status).toBe(200);

    const conversationA = await prisma.conversation.create({
      data: { tenantId: accountA.tenantId, contactId: contactA.id },
      select: { id: true },
    });

    const logout = await fetch(`${baseUrl}/v1/auth/logout`, {
      method: "POST",
      headers: { cookie: accountA.cookies, "x-csrf-token": accountA.csrfToken },
    });
    expect(logout.status).toBe(204);

    const revokedAccess = await request("/v1/auth/me", { session: accountA });
    expect(revokedAccess.status).toBe(401);

    await stopApiProcess(api);
    await disconnectDatabase();
    api = await startApiProcess({ PLATFORM_OWNER_EMAIL: accountAEmail });
    baseUrl = api.baseUrl;

    const wrongPassword = await fetch(`${baseUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: accountAEmail, password: "senha-incorreta" }),
    });
    expect(wrongPassword.status).toBe(401);

    let loggedA = await login(accountAEmail, password);
    const profileResponse = await request("/v1/auth/me", { session: loggedA });
    expect(profileResponse.status).toBe(200);
    const profile = await jsonData<{ tenant: { id: string; name: string } }>(profileResponse);
    expect(profile.tenant).toEqual({ id: accountA.tenantId, name: `Empresa Persistida A ${suffix}` });

    const persistedContact = await request(`/v1/crm/contacts/${contactA.id}`, { session: loggedA });
    expect(persistedContact.status).toBe(200);
    expect((await jsonData<{ displayName: string }>(persistedContact)).displayName).toBe("Cliente Teste Persistência");
    expect(await prisma.membership.count({ where: { tenantId: accountA.tenantId, userId: accountA.userId, active: true } })).toBe(1);

    const previousSession = loggedA;
    const refresh = await fetch(`${baseUrl}/v1/auth/refresh`, {
      method: "POST",
      headers: { cookie: loggedA.cookies, "x-csrf-token": loggedA.csrfToken },
    });
    expect(refresh.status).toBe(200);
    const refreshed = await jsonData<{ session: { accessToken: string; csrfToken: string } }>(refresh);
    loggedA = {
      ...loggedA,
      accessToken: refreshed.session.accessToken,
      csrfToken: refreshed.session.csrfToken,
      cookies: sessionCookies(refresh),
    };
    const reusedRefresh = await fetch(`${baseUrl}/v1/auth/refresh`, {
      method: "POST",
      headers: { cookie: previousSession.cookies, "x-csrf-token": previousSession.csrfToken },
    });
    expect(reusedRefresh.status).toBe(401);
    expect((await request("/v1/auth/me", { session: loggedA })).status).toBe(401);
    loggedA = await login(accountAEmail, password);

    const accountB = await register({
      companyName: `Empresa Isolada B ${suffix}`,
      fullName: "Usuário Homologação B",
      email: `homologacao-b-${suffix}@example.test`,
      password,
    });
    createdTenantIds.push(accountB.tenantId);
    createdUserIds.push(accountB.userId);

    const contactBResponse = await request("/v1/crm/contacts", {
      method: "POST",
      session: accountB,
      body: {
        displayName: "Contato exclusivo B",
        phoneE164: `+55118${suffix.replace(/\D/gu, "").padEnd(7, "1").slice(0, 7)}`,
        tags: ["tenant-b"],
      },
    });
    const contactB = await jsonData<{ id: string }>(contactBResponse);

    const productBResponse = await request("/v1/knowledge/products", {
      method: "POST",
      session: accountB,
      body: { name: `Produto B ${suffix}`, description: "Produto exclusivo B" },
    });
    const productB = await jsonData<{ id: string }>(productBResponse);
    await request("/v1/ai/configuration", {
      method: "PUT",
      session: accountB,
      body: aiConfiguration(`tom exclusivo B ${suffix}`),
    });
    const conversationB = await prisma.conversation.create({
      data: { tenantId: accountB.tenantId, contactId: contactB.id },
      select: { id: true },
    });

    const injectedQuery = await request(
      `/v1/crm/contacts?tenantId=${encodeURIComponent(accountB.tenantId)}`,
      { session: loggedA },
    );
    expect(injectedQuery.status).toBe(200);
    const injectedQueryContacts = await jsonData<{ items: Array<{ id: string }> }>(injectedQuery);
    expect(injectedQueryContacts.items.some((item) => item.id === contactA.id)).toBe(true);
    expect(injectedQueryContacts.items.some((item) => item.id === contactB.id)).toBe(false);

    expect((await request(`/v1/crm/contacts/${contactB.id}`, { session: loggedA })).status).toBe(404);
    expect((await request(`/v1/conversations/${conversationB.id}`, { session: loggedA })).status).toBe(404);
    expect((await request(`/v1/knowledge/products/${productB.id}`, {
      method: "PATCH",
      session: loggedA,
      body: { name: "Tentativa cruzada" },
    })).status).toBe(404);

    const injectedConfiguration = await request("/v1/ai/configuration", {
      method: "PUT",
      session: loggedA,
      body: { ...aiConfiguration(`tom atualizado A ${suffix}`), tenantId: accountB.tenantId },
    });
    expect(injectedConfiguration.status).toBe(200);
    expect((await prisma.aiConfiguration.findUniqueOrThrow({ where: { tenantId: accountB.tenantId } })).tone).toBe(`tom exclusivo B ${suffix}`);
    expect((await prisma.aiConfiguration.findUniqueOrThrow({ where: { tenantId: accountA.tenantId } })).tone).toBe(`tom atualizado A ${suffix}`);

    const forgedHeader = await fetch(`${baseUrl}/v1/crm/contacts/${contactA.id}`, {
      headers: {
        authorization: `Bearer ${loggedA.accessToken}`,
        "x-tenant-id": accountB.tenantId,
      },
    });
    expect(forgedHeader.status).toBe(403);

    expect(await prisma.platformMembership.findUnique({ where: { userId: accountA.userId } })).toBeNull();
    await prisma.user.update({ where: { id: accountA.userId }, data: { isSuperAdmin: true } });
    expect((await request("/v1/super-admin/overview", { session: loggedA })).status).toBe(403);

    const refreshTokenB = cookieValue(accountB.cookies, "atendeia.refresh");
    await prisma.refreshSession.update({
      where: { tokenHash: sha256ForTest(refreshTokenB) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expiredRefresh = await fetch(`${baseUrl}/v1/auth/refresh`, {
      method: "POST",
      headers: { cookie: accountB.cookies, "x-csrf-token": accountB.csrfToken },
    });
    expect(expiredRefresh.status).toBe(401);
    expect(productA.id).toBeTruthy();
    expect(conversationA.id).toBeTruthy();
  }, 30_000);

  async function register(input: { companyName: string; fullName: string; email: string; password: string }): Promise<Session> {
    const response = await fetch(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(response.status).toBe(201);
    const data = await jsonData<{
      user: { id: string };
      tenant: { id: string };
      session: { accessToken: string; csrfToken: string };
    }>(response);
    return {
      accessToken: data.session.accessToken,
      csrfToken: data.session.csrfToken,
      tenantId: data.tenant.id,
      userId: data.user.id,
      cookies: sessionCookies(response),
    };
  }

  async function login(email: string, passwordValue: string): Promise<Session> {
    const response = await fetch(`${baseUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: passwordValue }),
    });
    expect(response.status).toBe(200);
    const data = await jsonData<{
      user: { id: string };
      tenant: { id: string };
      session: { accessToken: string; csrfToken: string };
    }>(response);
    return {
      accessToken: data.session.accessToken,
      csrfToken: data.session.csrfToken,
      tenantId: data.tenant.id,
      userId: data.user.id,
      cookies: sessionCookies(response),
    };
  }

  function request(path: string, options: { method?: string; session: Session; body?: unknown }) {
    return fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        authorization: `Bearer ${options.session.accessToken}`,
        "x-tenant-id": options.session.tenantId,
        "x-csrf-token": options.session.csrfToken,
        cookie: options.session.cookies,
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  }
});

function aiConfiguration(tone: string) {
  return {
    enabled: false,
    tone,
    minimumConfidence: 0.8,
    fallbackMessage: null,
    transferMessage: null,
    maxContextMessages: 20,
  };
}

async function jsonData<T>(response: Response): Promise<T> {
  const payload = await response.json() as { data: T };
  return payload.data;
}

function sessionCookies(response: Response): string {
  const values = (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie();
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

function cookieValue(cookies: string, name: string): string {
  const item = cookies.split("; ").find((value) => value.startsWith(`${name}=`));
  if (!item) throw new Error(`Cookie ${name} ausente`);
  return decodeURIComponent(item.slice(name.length + 1));
}

function sha256ForTest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function startApiProcess(environment: NodeJS.ProcessEnv = {}): Promise<ApiProcess> {
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...environment,
      PORT: String(port),
      LOG_LEVEL: "silent",
      EXTERNAL_INTEGRATIONS_ENABLED: "false",
    },
    stdio: "ignore",
  });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("A API de aceitação encerrou antes de ficar pronta; consulte os logs seguros do runtime");
    }
    try {
      const readiness = await fetch(`${baseUrl}/ready`);
      if (readiness.status === 200) {
        return { child, baseUrl };
      }
    } catch {
      // O processo ainda está iniciando ou aguardando a primeira conexão PostgreSQL.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await stopChild(child);
  throw new Error("A API de aceitação não ficou pronta em 20 segundos");
}

async function stopApiProcess(api: ApiProcess): Promise<void> {
  await stopChild(api.child);
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  if (await waitForExit(child, 5_000)) return;
  child.kill("SIGKILL");
  if (!(await waitForExit(child, 5_000))) {
    throw new Error("Não foi possível encerrar o processo isolado da API de aceitação");
  }
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null) return true;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    child.once("exit", onExit);
  });
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Porta de aceitação indisponível");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}
