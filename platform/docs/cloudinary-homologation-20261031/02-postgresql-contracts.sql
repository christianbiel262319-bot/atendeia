-- Execute the statements in one transaction, exclusively on br-red-term-aft504d9.
-- Every fixture and fixture mutation is rolled back before results are returned.
CREATE TEMP TABLE "CloudinaryTestResults" (name text NOT NULL, passed boolean NOT NULL) ON COMMIT DROP;

DO $tests$
DECLARE
 tenant_a uuid := gen_random_uuid(); tenant_b uuid := gen_random_uuid();
 user_a uuid := gen_random_uuid(); asset_id uuid := gen_random_uuid();
 product_a uuid := gen_random_uuid(); product_shared uuid := gen_random_uuid();
 task_id uuid := gen_random_uuid(); public_id text;
 results text[] := ARRAY[]::text[];
 affected integer; blocked boolean; lease_time timestamp(3) := clock_timestamp() + interval '2 minutes';
BEGIN
 IF current_database() <> 'atendeia_homologacao' THEN RAISE EXCEPTION 'Unexpected database'; END IF;
 public_id := 'atendeia/' || tenant_a || '/homologation-only';
 BEGIN
  INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES
   (tenant_a,'Cloudinary SQL test A','cloudinary-sql-' || tenant_a,now()),
   (tenant_b,'Cloudinary SQL test B','cloudinary-sql-' || tenant_b,now());
  INSERT INTO "User" (id,email,"passwordHash","fullName","updatedAt") VALUES
   (user_a,user_a || '@example.test','test-only-not-a-login-hash','Cloudinary SQL test',now());
  INSERT INTO "MediaAsset" (id,"tenantId","createdByUserId","publicId","secureUrl","resourceType","updatedAt") VALUES
   (asset_id,tenant_a,user_a,public_id,'https://example.test/no-provider-request','image',now());
  INSERT INTO "Product" (id,"tenantId",name,description,"imageAssetId","updatedAt") VALUES
   (product_a,tenant_a,'SQL fixture A','Test only',asset_id,now()),
   (product_shared,tenant_a,'SQL shared fixture','Test only',asset_id,now());

  blocked := false;
  BEGIN DELETE FROM "MediaAsset" WHERE id=asset_id;
  EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Referenced image was deleted'; END IF;
  results := array_append(results,'FK restrict protects referenced images');

  DELETE FROM "MediaAsset" m WHERE m.id=asset_id AND m."tenantId"=tenant_a
   AND NOT EXISTS(SELECT 1 FROM "Product" p WHERE p."imageAssetId"=m.id AND p."tenantId"=m."tenantId");
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Shared image deleted'; END IF;
  results := array_append(results,'Shared image survives worker eligibility filter');

  blocked := false;
  BEGIN
   INSERT INTO "Product" (id,"tenantId",name,description,"imageAssetId","updatedAt") VALUES
    (gen_random_uuid(),tenant_b,'Cross tenant fixture','Must fail',asset_id,now());
  EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Cross tenant reference allowed'; END IF;
  results := array_append(results,'Composite FK rejects cross-tenant image link');

  DELETE FROM "MediaAsset" WHERE id=asset_id AND "tenantId"=tenant_b;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Wrong tenant affected media'; END IF;
  results := array_append(results,'Tenant-scoped deletion cannot affect another tenant');

  BEGIN
   UPDATE "Product" SET "imageAssetId"=NULL WHERE id=product_a;
   INSERT INTO "MediaCleanupTask" (id,"tenantId","mediaAssetId","publicId","resourceType","updatedAt")
    VALUES(task_id,tenant_a,asset_id,public_id,'image',now());
   RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='simulated pre-commit crash';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  IF (SELECT "imageAssetId" FROM "Product" WHERE id=product_a) IS DISTINCT FROM asset_id OR
    EXISTS(SELECT 1 FROM "MediaCleanupTask" WHERE id=task_id)
   THEN RAISE EXCEPTION 'Product/outbox rollback failed'; END IF;
  results := array_append(results,'Product edit and cleanup intent roll back together');

  PERFORM "imageAssetId" FROM "Product" WHERE id=product_a AND "tenantId"=tenant_a FOR UPDATE;
  PERFORM pg_advisory_xact_lock(hashtextextended(tenant_a || ':' || public_id,0))::text;
  results := array_append(results,'Product row lock and media identity advisory lock are valid PostgreSQL');

  UPDATE "Product" SET "imageAssetId"=NULL WHERE id=product_a;
  INSERT INTO "MediaCleanupTask" (id,"tenantId","mediaAssetId","publicId","resourceType","updatedAt")
   VALUES(task_id,tenant_a,asset_id,public_id,'image',now());
  DELETE FROM "MediaAsset" m WHERE m.id=asset_id AND m."tenantId"=tenant_a
   AND NOT EXISTS(SELECT 1 FROM "Product" p WHERE p."imageAssetId"=m.id AND p."tenantId"=m."tenantId");
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Remaining reference was ignored'; END IF;
  results := array_append(results,'Unlinking one product preserves the remaining reference');

  UPDATE "MediaCleanupTask" SET "nextAttemptAt"=now()-interval '1 second' WHERE id=task_id;
  UPDATE "MediaCleanupTask" SET "leasedUntil"=lease_time,attempts=attempts+1,"updatedAt"=now()
   WHERE id=task_id AND "completedAt" IS NULL AND "nextAttemptAt"<=now()
    AND ("leasedUntil" IS NULL OR "leasedUntil"<now());
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Initial task claim failed'; END IF;
  UPDATE "MediaCleanupTask" SET "leasedUntil"=lease_time,attempts=attempts+1,"updatedAt"=now()
   WHERE id=task_id AND "completedAt" IS NULL AND "nextAttemptAt"<=now()
    AND ("leasedUntil" IS NULL OR "leasedUntil"<now());
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected<>0 OR (SELECT attempts FROM "MediaCleanupTask" WHERE id=task_id)<>1
   THEN RAISE EXCEPTION 'Double claim allowed'; END IF;
  results := array_append(results,'Conditional lease update allows one claim');

  INSERT INTO "MediaCleanupTask" (id,"tenantId","mediaAssetId","publicId","resourceType","updatedAt")
   VALUES(gen_random_uuid(),tenant_a,asset_id,public_id,'image',now())
   ON CONFLICT ("tenantId","mediaAssetId") DO NOTHING;
  IF (SELECT "leasedUntil" FROM "MediaCleanupTask" WHERE id=task_id) IS DISTINCT FROM lease_time
   THEN RAISE EXCEPTION 'Re-enqueue revoked lease'; END IF;
  results := array_append(results,'Idempotent enqueue preserves active lease');

  UPDATE "Product" SET "imageAssetId"=NULL WHERE id=product_shared;
  DELETE FROM "MediaAsset" m WHERE m.id=asset_id AND m."tenantId"=tenant_a
   AND NOT EXISTS(SELECT 1 FROM "Product" p WHERE p."imageAssetId"=m.id AND p."tenantId"=m."tenantId");
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Unreferenced asset retirement failed'; END IF;
  UPDATE "MediaCleanupTask" SET "retiredAt"=now(),"updatedAt"=now() WHERE id=task_id AND "leasedUntil"=lease_time;
  IF NOT EXISTS(SELECT 1 FROM "MediaCleanupTask" WHERE id=task_id AND "retiredAt" IS NOT NULL)
   THEN RAISE EXCEPTION 'Outbox lost asset identity'; END IF;
  results := array_append(results,'Cleanup intent survives removal of MediaAsset');

  blocked := false;
  BEGIN UPDATE "Product" SET "imageAssetId"=asset_id WHERE id=product_a;
  EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Retired asset reattached'; END IF;
  results := array_append(results,'Retired MediaAsset cannot be reattached by foreign key');

  UPDATE "MediaCleanupTask" SET "leasedUntil"=NULL,"nextAttemptAt"=now()+interval '5 seconds',"updatedAt"=now()
   WHERE id=task_id AND "leasedUntil"=lease_time;
  IF NOT EXISTS(SELECT 1 FROM "MediaCleanupTask" WHERE id=task_id AND "retiredAt" IS NOT NULL
    AND "completedAt" IS NULL AND "leasedUntil" IS NULL AND "nextAttemptAt">now())
   THEN RAISE EXCEPTION 'Failure lost retry intent'; END IF;
  results := array_append(results,'Provider-failure retry state retains public identity');

  blocked := false;
  BEGIN
   INSERT INTO "MediaCleanupTask" (id,"tenantId","mediaAssetId","publicId","resourceType","updatedAt")
    VALUES(gen_random_uuid(),tenant_a,gen_random_uuid(),public_id,'image',now());
  EXCEPTION WHEN unique_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Duplicate public identity allowed'; END IF;
  results := array_append(results,'Public identity uniqueness preserves retirement tombstone');

  UPDATE "MediaCleanupTask" SET "nextAttemptAt"=now()-interval '1 minute',"leasedUntil"=now()-interval '1 minute',"updatedAt"=now() WHERE id=task_id;
  UPDATE "MediaCleanupTask" SET "leasedUntil"=lease_time,attempts=attempts+1,"updatedAt"=now()
   WHERE id=task_id AND "completedAt" IS NULL AND "nextAttemptAt"<=now()
    AND ("leasedUntil" IS NULL OR "leasedUntil"<now());
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Expired lease not reclaimed'; END IF;
  results := array_append(results,'Expired worker lease can be reclaimed');

  UPDATE "MediaCleanupTask" SET "completedAt"=now(),"leasedUntil"=NULL,"updatedAt"=now() WHERE id=task_id;
  IF EXISTS(SELECT 1 FROM "MediaCleanupTask" WHERE id=task_id AND "completedAt" IS NULL AND "nextAttemptAt"<=now())
   THEN RAISE EXCEPTION 'Completed task still selectable'; END IF;
  results := array_append(results,'Completed tombstone is excluded from pending work');

  RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='ATENDEIA_FIXTURE_ROLLBACK';
 EXCEPTION WHEN no_data_found THEN
  IF SQLERRM <> 'ATENDEIA_FIXTURE_ROLLBACK' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM "Tenant" WHERE id IN (tenant_a,tenant_b)) OR
    EXISTS(SELECT 1 FROM "MediaCleanupTask" WHERE id=task_id) OR
    EXISTS(SELECT 1 FROM "User" WHERE id=user_a)
  THEN RAISE EXCEPTION 'Fixture rollback left data behind'; END IF;
 results := array_append(results,'All fixtures rolled back without touching existing rows');
 INSERT INTO "CloudinaryTestResults" SELECT unnest(results),true;
END $tests$;

SELECT name,passed FROM "CloudinaryTestResults" ORDER BY name;
