import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/infra/database/prisma.js";
import { env } from "../src/config/env.js";
import { KnowledgeService } from "../src/modules/knowledge/knowledge.service.js";
import { MediaService, cloudinarySignature } from "../src/modules/media/media.service.js";
import { runMediaCleanupOnce, scheduleMediaCleanup } from "../src/modules/media/media-cleanup.service.js";

const suite = process.env.ATENDEIA_RUN_MEDIA_POSTGRES_TESTS === "true" ? describe : describe.skip;
suite("cleanup with real PostgreSQL and simulated Cloudinary", () => {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const context = { tenantId, userId, role: "OWNER" as const };
  const knowledge = new KnowledgeService();
  const previous = { ...env };
  const provider = vi.fn<typeof fetch>();
  beforeAll(async () => {
    if (!/(test|homolog|hml)/iu.test(new URL(env.DATABASE_URL).pathname)) throw new Error("Use a dedicated test database");
    await prisma.tenant.create({ data: { id: tenantId, name: "Cleanup test", slug: `cleanup-${tenantId}` } });
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, passwordHash: "test", fullName: "Cleanup test" } });
    Object.assign(env, { EXTERNAL_INTEGRATIONS_ENABLED: true, CLOUDINARY_CLOUD_NAME: "test", CLOUDINARY_API_KEY: "test", CLOUDINARY_API_SECRET: "test" });
    vi.stubGlobal("fetch", provider);
  });
  afterEach(async () => {
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.mediaAsset.deleteMany({ where: { tenantId } });
    await prisma.mediaCleanupTask.deleteMany({ where: { tenantId } });
    provider.mockReset();
  });
  afterAll(async () => {
    Object.assign(env, previous);
    vi.unstubAllGlobals();
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
  async function fixture() {
    const asset = await prisma.mediaAsset.create({ data: { tenantId, createdByUserId: userId, publicId: `atendeia/${tenantId}/${randomUUID()}`, secureUrl: "https://res.cloudinary.com/test/image/upload/test.png", resourceType: "image" } });
    const product = await prisma.product.create({ data: { tenantId, name: "Test", description: "Test", imageAssetId: asset.id } });
    provider.mockResolvedValue(new Response(JSON.stringify({ result: "ok" })));
    return { asset, product };
  }
  it("preserves shared images, queues unlink atomically, and blocks replay after cleanup", async () => {
    const { asset, product } = await fixture();
    const shared = await prisma.product.create({ data: { tenantId, name: "Shared", description: "Test", imageAssetId: asset.id } });
    await knowledge.updateProduct(context, product.id, { imageAssetId: null });
    await runMediaCleanupOnce();
    expect(provider).not.toHaveBeenCalled();
    expect(await prisma.mediaAsset.findUnique({ where: { id: asset.id } })).not.toBeNull();
    await knowledge.remove(context, "product", shared.id);
    await prisma.mediaCleanupTask.updateMany({ where: { tenantId }, data: { nextAttemptAt: new Date(0) } });
    await runMediaCleanupOnce();
    expect(provider).toHaveBeenCalledTimes(1);
    expect(await prisma.mediaAsset.findUnique({ where: { id: asset.id } })).toBeNull();
    await expect(new MediaService().register(context, { publicId: asset.publicId, secureUrl: asset.secureUrl, version: 1, resourceType: "image", signature: cloudinarySignature({ public_id: asset.publicId, version: 1 }, "test") })).rejects.toMatchObject({ code: "MEDIA_RETIRED" });
  });
  it("rolls back product and outbox changes together", async () => {
    const { asset, product } = await fixture();
    await expect(prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: product.id }, data: { imageAssetId: null } });
      await scheduleMediaCleanup(tx, context, asset.id);
      throw new Error("crash before commit");
    })).rejects.toThrow("crash before commit");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).imageAssetId).toBe(asset.id);
    expect(await prisma.mediaCleanupTask.count({ where: { tenantId } })).toBe(0);
  });
  it("recovers provider failures after reconnect and allows only one concurrent claim", async () => {
    const { product } = await fixture();
    await knowledge.remove(context, "product", product.id);
    provider.mockRejectedValueOnce(new Error("provider offline"));
    await runMediaCleanupOnce();
    await prisma.$disconnect();
    const task = await prisma.mediaCleanupTask.findFirstOrThrow({ where: { tenantId } });
    expect(task.retiredAt).not.toBeNull();
    expect(task.completedAt).toBeNull();
    await prisma.mediaCleanupTask.update({ where: { id: task.id }, data: { nextAttemptAt: new Date(0), leasedUntil: new Date(0) } });
    provider.mockClear();
    await Promise.all([runMediaCleanupOnce(), runMediaCleanupOnce()]);
    expect(provider).toHaveBeenCalledTimes(1);
    expect((await prisma.mediaCleanupTask.findUniqueOrThrow({ where: { id: task.id } })).completedAt).not.toBeNull();
  });
});
