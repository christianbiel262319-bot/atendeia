import type { Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../infra/database/prisma.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { cloudinarySignature } from "./cloudinary-signature.js";

/**
 * Durable cleanup request. Enqueue in the SAME database transaction that
 * changes/deletes the product; a crash cannot silently lose the request.
 */
export async function scheduleMediaCleanup(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  mediaAssetId: string,
): Promise<void> {
  const asset = await tx.mediaAsset.findFirst({
    where: { id: mediaAssetId, tenantId: context.tenantId },
    select: { id: true, publicId: true, resourceType: true },
  });
  if (!asset || !asset.publicId.startsWith(`atendeia/${context.tenantId}/`)) return;
  await tx.mediaCleanupTask.upsert({
    where: { tenantId_mediaAssetId: { tenantId: context.tenantId, mediaAssetId } },
    create: {
      tenantId: context.tenantId,
      mediaAssetId,
      publicId: asset.publicId,
      resourceType: asset.resourceType,
    },
    update: {}, // Never revoke a worker lease when another product unlinks the same image.
  });
}

export function mediaCleanupRetryDelay(attempts: number): number {
  return Math.min(60 * 60 * 1_000, 5_000 * 2 ** Math.min(10, Math.max(0, attempts - 1)));
}

/**
 * Claim via a conditional update, so multiple API processes cannot claim the
 * same due task concurrently. PostgreSQL is the durable task source.
 */
export async function lockMediaIdentity(tx: Prisma.TransactionClient, tenantId: string, publicId: string): Promise<void> {
  // Registration and retirement must serialize even after the MediaAsset row is gone.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${publicId}`}, 0))::text`;
}

export async function runMediaCleanupOnce(): Promise<boolean> {
  if (!env.EXTERNAL_INTEGRATIONS_ENABLED || !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return false;
  const now = new Date();
  const task = await prisma.mediaCleanupTask.findFirst({
    where: { completedAt: null, nextAttemptAt: { lte: now }, OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }] },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
  });
  if (!task) return false;

  const lease = new Date(now.getTime() + 120_000);
  const claimed = await prisma.mediaCleanupTask.updateMany({
    where: {
      id: task.id,
      completedAt: null,
      nextAttemptAt: { lte: now },
      OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }],
    },
    data: { leasedUntil: lease, attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return true;

  const ownedTask = { id: task.id, leasedUntil: lease };
  try {
    if (!task.publicId.startsWith(`atendeia/${task.tenantId}/`) ||
        !["image", "video", "raw"].includes(task.resourceType)) {
      throw new Error("Invalid cleanup identity");
    }
    const state = await prisma.$transaction(async (tx) => {
      await lockMediaIdentity(tx, task.tenantId, task.publicId);
      const owned = await tx.mediaCleanupTask.findFirst({ where: ownedTask });
      if (!owned || owned.completedAt) return "STALE" as const;
      const identity = await tx.mediaAsset.findFirst({
        where: { tenantId: task.tenantId, publicId: task.publicId },
      });
      if (identity && (identity.id !== task.mediaAssetId || identity.resourceType !== task.resourceType)) {
        throw new Error("Cleanup asset identity changed");
      }
      // DELETE is committed BEFORE invoking Cloudinary, so the FK prevents any
      // product from subsequently referring to an already-destroyed image.
      const removed = await tx.mediaAsset.deleteMany({
        where: {
          id: task.mediaAssetId,
          tenantId: task.tenantId,
          productImages: { none: {} },
        },
      });
      if (removed.count === 1) {
        await tx.mediaCleanupTask.updateMany({ where: ownedTask, data: { retiredAt: new Date() } });
        return "READY" as const;
      }
      const stillExists = await tx.mediaAsset.findFirst({
        where: { id: task.mediaAssetId, tenantId: task.tenantId },
        select: { id: true },
      });
      if (stillExists) return "IN_USE" as const;
      await tx.mediaCleanupTask.updateMany({ where: ownedTask, data: { retiredAt: new Date() } });
      return "READY" as const;
    });

    if (state === "STALE") return true;
    if (state === "IN_USE") {
      // Keep the durable request and re-check in one hour without deleting an in-use image.
      await prisma.mediaCleanupTask.updateMany({
        where: ownedTask,
        data: { leasedUntil: null, nextAttemptAt: new Date(Date.now() + 60 * 60 * 1_000) },
      });
      return true;
    }

    await destroyCloudinaryAsset(task.publicId, task.resourceType);
    // Keep the tombstone: old signed upload responses must not resurrect deleted media.
    await prisma.mediaCleanupTask.updateMany({
      where: ownedTask, data: { completedAt: new Date(), leasedUntil: null },
    });
    return true;
  } catch (error) {
    logger.warn({ taskId: task.id, tenantId: task.tenantId, error }, "Cloudinary media cleanup deferred");
    await prisma.mediaCleanupTask.updateMany({
      where: ownedTask,
      data: {
        leasedUntil: null,
        nextAttemptAt: new Date(Date.now() + mediaCleanupRetryDelay(task.attempts + 1)),
      },
    });
    return true;
  }
}

async function destroyCloudinaryAsset(publicId: string, resourceType: string): Promise<void> {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured");
  }
  if (!["image", "video", "raw"].includes(resourceType)) throw new Error("Unsupported Cloudinary resource type");
  if (!publicId.startsWith("atendeia/")) throw new Error("Invalid Cloudinary public ID");
  const timestamp = Math.floor(Date.now() / 1_000);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: env.CLOUDINARY_API_KEY,
    signature: cloudinarySignature({ public_id: publicId, timestamp }, env.CLOUDINARY_API_SECRET),
  });
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/${resourceType}/destroy`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw new Error(`Cloudinary destroy returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("result" in payload) ||
    (payload.result !== "ok" && payload.result !== "not found")) {
    throw new Error("Cloudinary did not confirm deletion");
  }
}

/** Start in the API process so cleanup runs even without a separate BullMQ worker deployment. */
export function startMediaCleanup(): () => Promise<void> {
  if (!env.EXTERNAL_INTEGRATIONS_ENABLED || !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return () => Promise.resolve();
  }
  let running: Promise<void> | null = null;
  const tick = () => {
    if (running) return;
    running = (async () => {
      for (let i = 0; i < 10 && await runMediaCleanupOnce(); i += 1) { /* batch */ }
    })().catch((error: unknown) => {
      logger.error({ error }, "Media cleanup poll failed");
    }).finally(() => { running = null; });
  };
  const timer = setInterval(tick, 15_000);
  timer.unref();
  tick();
  return async () => {
    clearInterval(timer);
    await running;
  };
}
