import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { prisma } from "../src/infra/database/prisma.js";
import { KnowledgeService } from "../src/modules/knowledge/knowledge.service.js";
import { productSchema } from "../src/modules/knowledge/knowledge.schemas.js";
import {
  MediaService,
  cloudinarySignature,
} from "../src/modules/media/media.service.js";
import { runMediaCleanupOnce } from "../src/modules/media/media-cleanup.service.js";
import {
  assertDisposableOwnership,
  disposablePublicId,
  disposableTag,
  type CloudinaryIdentity,
  type DisposableImage,
} from "../scripts/test-support/cloudinary-fixtures.js";

const enabled = process.env.ATENDEIA_RUN_CLOUDINARY_LIVE === "true";
const suite = enabled ? describe : describe.skip;
suite("real Cloudinary with disposable images and real PostgreSQL", () => {
  const runId = randomUUID();
  const tenantA: string = randomUUID(),
    tenantB: string = randomUUID(),
    userA: string = randomUUID(),
    userB: string = randomUUID();
  const a = { tenantId: tenantA, userId: userA, role: "OWNER" as const },
    b = { tenantId: tenantB, userId: userB, role: "OWNER" as const };
  const owned = new Map<string, DisposableImage>();
  const attemptedPublicIds = new Set<string>();
  const uploads = new Map<
    string,
    {
      publicId: string;
      secureUrl: string;
      version: number;
      signature: string;
      resourceType: "image";
    }
  >();
  const originalFetch = globalThis.fetch.bind(globalThis);
  const prior = { ...env };
  const knowledge = new KnowledgeService(),
    media = new MediaService();
  let targetVerified = false;
  let injectedFailure = false,
    destroyRequests = 0;
  function config() {
    if (
      !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY ||
      !env.CLOUDINARY_API_SECRET ||
      process.env.ATENDEIA_CLOUDINARY_EXPECTED_CLOUD !==
        env.CLOUDINARY_CLOUD_NAME
    )
      throw new Error(
        "Cloudinary test account is not securely configured and confirmed",
      );
    return {
      cloud: env.CLOUDINARY_CLOUD_NAME,
      key: env.CLOUDINARY_API_KEY,
      secret: env.CLOUDINARY_API_SECRET,
    };
  }
  async function lookup(publicId: string): Promise<CloudinaryIdentity | null> {
    const c = config();
    const r = await originalFetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloud)}/resources/image/upload/${encodeURIComponent(publicId)}?tags=true`,
      {
        headers: {
          authorization: `Basic ${Buffer.from(`${c.key}:${c.secret}`).toString("base64")}`,
        },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (r.status === 404) return null;
    if (!r.ok)
      throw new Error(
        `Cloudinary resource verification failed (HTTP ${r.status})`,
      );
    return (await r.json()) as CloudinaryIdentity;
  }
  async function upload(tenantId: string, label: "shared" | "isolated") {
    const c = config(),
      publicId = disposablePublicId(tenantId, runId, label);
    if (await lookup(publicId))
      throw new Error("Disposable public ID already exists; refusing upload");
    const params = {
      public_id: publicId,
      tags: disposableTag(runId),
      overwrite: "false",
      timestamp: Math.floor(Date.now() / 1000),
    };
    const body = new FormData();
    for (const [key, value] of Object.entries(params))
      body.set(key, String(value));
    body.set("api_key", c.key);
    body.set("signature", cloudinarySignature(params, c.secret));
    body.set(
      "file",
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6xkAAAAASUVORK5CYII=",
    );
    attemptedPublicIds.add(publicId);
    const r = await originalFetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloud)}/image/upload`,
      { method: "POST", body, signal: AbortSignal.timeout(20000) },
    );
    if (!r.ok) {
      const responseText = (await r.text()).slice(0, 4096).toLowerCase();
      const category =
        /invalid signature|signature mismatch/.test(responseText) ? "assinatura_invalida" :
        /invalid api key|invalid api secret|unknown api key/.test(responseText) ? "credencial_invalida" :
        /preset/.test(responseText) ? "restricao_preset" :
        /disabled|suspended|blocked/.test(responseText) ? "conta_ou_upload_bloqueado" :
        /not allowed|not permitted|forbidden|restriction|denied/.test(responseText) ? "permissao_negada" :
        "motivo_nao_classificado";
      throw new Error("Disposable upload failed (HTTP " + r.status + "; category=" + category + ")");
    }
    const receipt = (await r.json()) as CloudinaryIdentity & {
      secure_url: string;
      version: number;
      signature: string;
    };
    if (
      receipt.public_id !== publicId ||
      !receipt.asset_id ||
      !receipt.version ||
      !receipt.signature
    )
      throw new Error(
        "Invalid disposable upload receipt; manual review required",
      );
    owned.set(publicId, {
      tenantId,
      runId,
      publicId,
      assetId: receipt.asset_id,
    });
    const remote = await lookup(publicId);
    if (!remote) throw new Error("Disposable upload not found after creation");
    assertDisposableOwnership(publicId, owned, remote);
    const input = {
      publicId,
      secureUrl: receipt.secure_url,
      version: receipt.version,
      signature: receipt.signature,
      resourceType: "image" as const,
    };
    uploads.set(publicId, input);
    return input;
  }
  async function due() {
    const tasks = await prisma.mediaCleanupTask.findMany({
      where: { completedAt: null },
      select: { publicId: true, tenantId: true },
    });
    if (
      tasks.some(
        (task) =>
          !owned.has(task.publicId) ||
          ![tenantA, tenantB].includes(task.tenantId),
      )
    )
      throw new Error(
        "Foreign pending cleanup task found; stopping the live worker test",
      );
    await prisma.mediaCleanupTask.updateMany({
      where: { tenantId: { in: [tenantA, tenantB] }, completedAt: null },
      data: { nextAttemptAt: new Date(0), leasedUntil: null },
    });
  }
  beforeAll(async () => {
    const database = new URL(env.DATABASE_URL);
    if (
      process.env.ATENDEIA_TEST_NEON_WS !== "true" ||
      process.env.ATENDEIA_TEST_BRANCH_ID !== "br-red-term-aft504d9" ||
      env.NODE_ENV !== "test" ||
      env.ATENDEIA_DEPLOYMENT_STAGE !== "homologation" ||
      database.hostname !==
        "ep-aged-sea-afmt0kin.c-2.us-west-2.aws.neon.tech" ||
      database.pathname !== "/atendeia_homologacao"
    ) {
      throw new Error(
        "Live provider validation is restricted to the isolated Neon test runtime",
      );
    }
    targetVerified = true;
    config();
    if (await prisma.mediaCleanupTask.count())
      throw new Error(
        "Live validation requires an empty cleanup queue and exclusive test branch",
      );
    for (const [tenantId, userId] of [
      [tenantA, userA],
      [tenantB, userB],
    ] as const) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: "Disposable Cloudinary test",
          slug: `cloudinary-live-${tenantId}`,
        },
      });
      await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@example.test`,
          passwordHash: "not-a-valid-login",
          fullName: "Disposable Cloudinary test",
        },
      });
    }
    Object.assign(env, { EXTERNAL_INTEGRATIONS_ENABLED: true });
    globalThis.fetch = async (input, init) => {
      const address =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const c = config();
      if (
        address !==
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloud)}/image/destroy` ||
        init?.method !== "POST" ||
        !(init.body instanceof URLSearchParams)
      )
        throw new Error(
          "Live fixture guard rejected an unexpected provider request",
        );
      const publicId = init.body.get("public_id") ?? "";
      if (!owned.has(publicId))
        throw new Error("Refusing deletion outside disposable upload manifest");
      const remote = await lookup(publicId);
      if (remote) assertDisposableOwnership(publicId, owned, remote);
      if (
        publicId === disposablePublicId(tenantA, runId, "shared") &&
        !injectedFailure
      ) {
        injectedFailure = true;
        return new Response("Injected transient test failure", { status: 503 });
      }
      destroyRequests += 1;
      return originalFetch(input, init);
    };
  }, 60000);
  afterAll(async () => {
    if (!targetVerified) return;
    globalThis.fetch = originalFetch;
    const remaining: string[] = [];
    try {
      for (const [publicId] of owned) {
        try {
          const remote = await lookup(publicId);
          if (!remote) continue;
          assertDisposableOwnership(publicId, owned, remote);
          const c = config(),
            timestamp = Math.floor(Date.now() / 1000);
          const body = new URLSearchParams({
            public_id: publicId,
            timestamp: String(timestamp),
            api_key: c.key,
            signature: cloudinarySignature(
              { public_id: publicId, timestamp },
              c.secret,
            ),
          });
          const r = await originalFetch(
            `https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloud)}/image/destroy`,
            { method: "POST", body, signal: AbortSignal.timeout(20000) },
          );
          if (!r.ok || (await lookup(publicId))) remaining.push(publicId);
        } catch {
          remaining.push(publicId);
        }
      }
      // A timeout can occur after the provider accepted an upload. Without a
      // receipt, preserve the file and report its disposable ID for review.
      for (const publicId of attemptedPublicIds) {
        if (owned.has(publicId)) continue;
        try {
          if (await lookup(publicId)) remaining.push(publicId);
        } catch {
          remaining.push(publicId);
        }
      }
      await prisma.product.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.mediaAsset.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.mediaCleanupTask.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
      const evidence = process.env.ATENDEIA_TEST_EVIDENCE_DIR;
      if (evidence)
        writeFileSync(
          `${evidence}/cloudinary-manifest.json`,
          JSON.stringify(
            {
              runId,
              attemptedPublicIds: [...attemptedPublicIds],
              fixtures: [...owned.values()],
              remaining,
            },
            null,
            2,
          ),
        );
    } finally {
      Object.assign(env, prior);
      await prisma.$disconnect();
    }
    if (remaining.length)
      throw new Error(
        "Disposable assets remain; inspect the safe manifest before any manual cleanup",
      );
  }, 60000);
  it("preserves shared images, retries a provider failure, deletes only fixtures and isolates tenants", async () => {
    const uploadedA = await upload(tenantA, "shared"),
      uploadedB = await upload(tenantB, "isolated");
    const assetA = await media.register(a, uploadedA),
      assetB = await media.register(b, uploadedB);
    const first = await knowledge.createProduct(
      a,
      productSchema.parse({
        name: "Disposable A1",
        description: "Test",
        imageAssetId: assetA.id,
      }),
    );
    const shared = await knowledge.createProduct(
      a,
      productSchema.parse({
        name: "Disposable A2",
        description: "Test",
        imageAssetId: assetA.id,
      }),
    );
    const isolated = await knowledge.createProduct(
      b,
      productSchema.parse({
        name: "Disposable B",
        description: "Test",
        imageAssetId: assetB.id,
      }),
    );
    await expect(
      knowledge.createProduct(
        b,
        productSchema.parse({
          name: "Forbidden",
          description: "Test",
          imageAssetId: assetA.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(media.remove(b, assetA.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await knowledge.updateProduct(a, first.id, { imageAssetId: null });
    await due();
    await runMediaCleanupOnce();
    expect(destroyRequests).toBe(0);
    expect(await lookup(uploadedA.publicId)).not.toBeNull();
    await knowledge.remove(a, "product", shared.id);
    await due();
    await runMediaCleanupOnce();
    const failed = await prisma.mediaCleanupTask.findFirstOrThrow({
      where: { tenantId: tenantA, mediaAssetId: assetA.id },
    });
    expect(injectedFailure).toBe(true);
    expect(failed.retiredAt).not.toBeNull();
    expect(failed.completedAt).toBeNull();
    expect(await lookup(uploadedA.publicId)).not.toBeNull();
    await expect(media.register(a, uploadedA)).rejects.toMatchObject({
      code: "MEDIA_RETIRED",
    });
    await prisma.$disconnect();
    await due();
    await runMediaCleanupOnce();
    expect(await lookup(uploadedA.publicId)).toBeNull();
    expect(
      (
        await prisma.mediaCleanupTask.findUniqueOrThrow({
          where: { id: failed.id },
        })
      ).completedAt,
    ).not.toBeNull();
    expect(await lookup(uploadedB.publicId)).not.toBeNull();
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: isolated.id } }))
        .imageAssetId,
    ).toBe(assetB.id);
    await knowledge.remove(b, "product", isolated.id);
    await due();
    await runMediaCleanupOnce();
    expect(await lookup(uploadedB.publicId)).toBeNull();
    expect(destroyRequests).toBe(2);
  }, 180000);
});
