import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const db = {
    mediaCleanupTask: { findFirst: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
    mediaAsset: { findFirst: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  return { db, env: { SECRETS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"), LOG_LEVEL: "silent", EXTERNAL_INTEGRATIONS_ENABLED: true, CLOUDINARY_CLOUD_NAME: "test", CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "test-secret" } };
});
vi.mock("../src/infra/database/prisma.js", () => ({ prisma: mocks.db }));
vi.mock("../src/config/env.js", () => ({ env: mocks.env }));
import { runMediaCleanupOnce, scheduleMediaCleanup, mediaCleanupRetryDelay } from "../src/modules/media/media-cleanup.service.js";
import { MediaService, cloudinarySignature } from "../src/modules/media/media.service.js";
import type { Prisma } from "../src/generated/prisma/client.js";

const context = { tenantId: "tenant-a", userId: "user-a", role: "OWNER" as const };
const task = { id: "task", tenantId: context.tenantId, mediaAssetId: "asset", publicId: "atendeia/tenant-a/image", resourceType: "image", attempts: 0, completedAt: null };
const asset = { id: "asset", tenantId: context.tenantId, publicId: task.publicId, resourceType: "image" };
const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.EXTERNAL_INTEGRATIONS_ENABLED = true;
  vi.stubGlobal("fetch", fetchMock);
  mocks.db.$transaction.mockImplementation((callback: (db: typeof mocks.db) => unknown) => callback(mocks.db));
  mocks.db.mediaCleanupTask.findFirst.mockResolvedValue(task);
  mocks.db.mediaCleanupTask.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.mediaAsset.findFirst.mockResolvedValue(asset);
  mocks.db.mediaAsset.deleteMany.mockResolvedValue({ count: 1 });
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ result: "ok" }) });
});

describe("durable Cloudinary cleanup", () => {
  it("never calls the provider while a product still references the asset", async () => {
    mocks.db.mediaAsset.deleteMany.mockResolvedValue({ count: 0 });
    await runMediaCleanupOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.db.mediaAsset.deleteMany).toHaveBeenCalledWith({ where: { id: "asset", tenantId: "tenant-a", productImages: { none: {} } } });
  });
  it("commits retirement before deleting at the provider and retains a tombstone", async () => {
    fetchMock.mockImplementation(() => {
      expect(mocks.db.mediaCleanupTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { retiredAt: (expect.any(Date) as unknown) } }));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: "ok" }) });
    });
    await runMediaCleanupOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.db.mediaCleanupTask.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { completedAt: (expect.any(Date) as unknown), leasedUntil: null } }));
  });
  it.each(["not found", "ok"])("accepts idempotent provider result %s", async (result) => {
    mocks.db.mediaAsset.findFirst.mockResolvedValue(null);
    mocks.db.mediaAsset.deleteMany.mockResolvedValue({ count: 0 });
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ result }) });
    await runMediaCleanupOnce();
    expect(mocks.db.mediaCleanupTask.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: (expect.objectContaining({ completedAt: (expect.any(Date) as unknown) }) as unknown) }));
  });
  it.each(["http", "timeout", "unexpected", "fk"])("retries safely after %s failure", async (failure) => {
    if (failure === "http") fetchMock.mockResolvedValue({ ok: false, status: 503 });
    if (failure === "timeout") fetchMock.mockRejectedValue(new Error("timeout"));
    if (failure === "unexpected") fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ result: "error" }) });
    if (failure === "fk") mocks.db.mediaAsset.deleteMany.mockRejectedValue(new Error("foreign key"));
    await runMediaCleanupOnce();
    expect(mocks.db.mediaCleanupTask.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { leasedUntil: null, nextAttemptAt: (expect.any(Date) as unknown) } }));
    if (failure === "fk") expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does nothing without integrations", async () => {
    mocks.env.EXTERNAL_INTEGRATIONS_ENABLED = false;
    expect(await runMediaCleanupOnce()).toBe(false);
    expect(mocks.db.mediaCleanupTask.findFirst).not.toHaveBeenCalled();
  });
  it("does nothing when another worker wins the claim", async () => {
    mocks.db.mediaCleanupTask.updateMany.mockResolvedValueOnce({ count: 0 });
    await runMediaCleanupOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects a task pointing outside its tenant", async () => {
    mocks.db.mediaCleanupTask.findFirst.mockResolvedValueOnce({ ...task, publicId: "atendeia/tenant-b/image" });
    await runMediaCleanupOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.db.mediaAsset.deleteMany).not.toHaveBeenCalled();
  });
  it("does not delete a different asset registered under the same public ID", async () => {
    mocks.db.mediaAsset.findFirst.mockResolvedValue({ ...asset, id: "different" });
    await runMediaCleanupOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not revoke a lease when re-enqueuing", async () => {
    await scheduleMediaCleanup(mocks.db as unknown as Prisma.TransactionClient, context, "asset");
    expect(mocks.db.mediaCleanupTask.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });
  it("blocks replay of a signed upload after retirement", async () => {
    const input = { publicId: task.publicId, version: 1, resourceType: "image" as const, secureUrl: "https://res.cloudinary.com/test/image/upload/test.png", signature: cloudinarySignature({ public_id: task.publicId, version: 1 }, "test-secret") };
    await expect(new MediaService().register(context, input)).rejects.toMatchObject({ code: "MEDIA_RETIRED" });
    expect(mocks.db.mediaAsset.upsert).not.toHaveBeenCalled();
  });
  it("bounds exponential retry backoff", () => {
    expect(mediaCleanupRetryDelay(1)).toBe(5000);
    expect(mediaCleanupRetryDelay(2)).toBe(10000);
    expect(mediaCleanupRetryDelay(100)).toBe(3600000);
  });
});
