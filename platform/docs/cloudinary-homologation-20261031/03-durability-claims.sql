-- Evidence/reproduction plan: execute on Neon branch br-red-term-aft504d9 ONLY.
-- Run each phase on a separate request; run the two claims concurrently.
-- Generate three fresh UUIDs and substitute :task_id, :tenant_id, :asset_id.
-- The fixture has no real Cloudinary file, customer, product, or user.
-- Use a branch without active API/cleanup processes.

-- Phase 1: commit a retired task, representing a provider failure after retirement.
INSERT INTO "MediaCleanupTask" (id,"tenantId","mediaAssetId","publicId","resourceType",attempts,"nextAttemptAt","retiredAt","updatedAt")
VALUES (:'task_id',:'tenant_id',:'asset_id','atendeia/' || :'tenant_id' || '/test-durability','image',1,now()-interval '1 minute',now(),now());

-- Phase 2, separate request: must return retired=true, pending=true, attempts=1.
SELECT "retiredAt" IS NOT NULL AS retired,"completedAt" IS NULL AS pending,attempts
FROM "MediaCleanupTask" WHERE id=:'task_id' AND "tenantId"=:'tenant_id';

-- Phase 3: run this statement twice in parallel requests. Counts must be 0 and 1.
WITH claimed AS (
 UPDATE "MediaCleanupTask" SET "leasedUntil"=clock_timestamp()+interval '2 minutes',attempts=attempts+1,"updatedAt"=now()
 WHERE id=:'task_id' AND "tenantId"=:'tenant_id' AND "completedAt" IS NULL
 AND "nextAttemptAt"<=clock_timestamp() AND ("leasedUntil" IS NULL OR "leasedUntil"<clock_timestamp())
 RETURNING id
) SELECT count(*) AS claimed FROM claimed;

-- Phase 4: verify attempts=2, expire only this fixture's lease, run phase 3 once,
-- and verify claimed=1 and attempts=3.
SELECT attempts FROM "MediaCleanupTask" WHERE id=:'task_id' AND "tenantId"=:'tenant_id';
UPDATE "MediaCleanupTask" SET "leasedUntil"=now()-interval '1 minute',"updatedAt"=now()
WHERE id=:'task_id' AND "tenantId"=:'tenant_id';

-- Phase 5: complete, verify, then remove only this run's fixture.
UPDATE "MediaCleanupTask" SET "completedAt"=now(),"leasedUntil"=NULL,"updatedAt"=now()
WHERE id=:'task_id' AND "tenantId"=:'tenant_id';
SELECT attempts,"retiredAt" IS NOT NULL AS retired,"completedAt" IS NOT NULL AS completed
FROM "MediaCleanupTask" WHERE id=:'task_id' AND "tenantId"=:'tenant_id';
DELETE FROM "MediaCleanupTask" WHERE id=:'task_id' AND "tenantId"=:'tenant_id';
