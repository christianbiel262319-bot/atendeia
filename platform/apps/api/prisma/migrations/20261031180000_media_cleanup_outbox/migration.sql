-- Durable, tenant-scoped Cloudinary cleanup outbox; no existing media rows are altered.
CREATE TABLE "MediaCleanupTask" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "publicId" VARCHAR(240) NOT NULL,
    "resourceType" VARCHAR(40) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leasedUntil" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MediaCleanupTask_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MediaCleanupTask_tenantId_mediaAssetId_key"
    ON "MediaCleanupTask"("tenantId", "mediaAssetId");
CREATE INDEX "MediaCleanupTask_completedAt_nextAttemptAt_leasedUntil_idx"
    ON "MediaCleanupTask"("completedAt", "nextAttemptAt", "leasedUntil");
CREATE UNIQUE INDEX "MediaCleanupTask_tenantId_publicId_key"
    ON "MediaCleanupTask"("tenantId", "publicId");
