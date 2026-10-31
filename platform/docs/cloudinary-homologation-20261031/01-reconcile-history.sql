-- Run ONLY against Neon test branch br-red-term-aft504d9, never the parent.
-- Equivalent applied-history reconciliation after exact schema verification.
-- Direct Prisma CLI access was unavailable (DNS); no migration DDL is re-run.
BEGIN;

DO $guard$
BEGIN
 IF current_database() <> 'atendeia_homologacao' THEN RAISE EXCEPTION 'Unexpected database'; END IF;
 IF EXISTS (
  SELECT 1 FROM (VALUES ('20260817010000_init','a1229a07ef23c8971c5bb79028bc8bc49b4cbf67ecb01453c6f97a14e461c3d1'),
('20260819090000_auth_lifecycle','0372106adefc7175899a91f076d2f82e2c0b28bfb4f8c91e14bc2a1366639626'),
('20260819100000_tenant_relational_guards','6a6e002f1e42d8c3c91abbd5f4975f0bb567865d25d92eaea3d040e3b2a76af8'),
('20260819110000_crm_knowledge_expansion','b0786c818a3d728ca38c22fbd94830048a60d8f3c4e48fa3f8912606e34e1502'),
('20260823090000_platform_membership','187db38c2f6cb55504e79186f377f83e9e400bf97bdebaeadf9ec13bd2fab735'),
('20260906201000_publish_definitive_billing_plans','246245e25545b740c8c77f2056d3de8c7c4843ad0f60f921a3df51d32020422c')) expected(name,checksum)
  LEFT JOIN "_prisma_migrations" actual ON actual.migration_name=expected.name
  WHERE actual.checksum IS DISTINCT FROM expected.checksum OR actual.finished_at IS NULL OR actual.rolled_back_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'Base migration history differs'; END IF;
 IF EXISTS(SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261031180000_media_cleanup_outbox' AND
 (checksum<>'02c72b464ff915bb60e77179531735507772fd5f73aa5456ae36b7cb0c0b1f09' OR finished_at IS NULL OR rolled_back_at IS NOT NULL))
 THEN RAISE EXCEPTION 'Conflicting cleanup history'; END IF;
END $guard$;

CREATE TEMP TABLE "ExpectedMediaCleanupTask" (
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
    CONSTRAINT "ExpectedMediaCleanupTask_pkey" PRIMARY KEY ("id")
) ON COMMIT DROP;

CREATE UNIQUE INDEX "ExpectedMediaCleanupTask_tenantId_mediaAssetId_key"
    ON "ExpectedMediaCleanupTask"("tenantId", "mediaAssetId");

CREATE INDEX "ExpectedMediaCleanupTask_completedAt_nextAttemptAt_leasedUntil_idx"
    ON "ExpectedMediaCleanupTask"("completedAt", "nextAttemptAt", "leasedUntil");

CREATE UNIQUE INDEX "ExpectedMediaCleanupTask_tenantId_publicId_key"
    ON "ExpectedMediaCleanupTask"("tenantId", "publicId");

DO $verify$
DECLARE expected regclass := 'pg_temp."ExpectedMediaCleanupTask"'::regclass;
        actual regclass := 'public."MediaCleanupTask"'::regclass;
        left_shape jsonb; right_shape jsonb;
BEGIN
 SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) INTO left_shape
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=expected AND a.attnum>0 AND NOT a.attisdropped;
 SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) INTO right_shape
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=actual AND a.attnum>0 AND NOT a.attisdropped;
 IF left_shape IS DISTINCT FROM right_shape THEN RAISE EXCEPTION 'MediaCleanupTask columns mismatch'; END IF;
 SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY pg_get_constraintdef(oid)) INTO left_shape FROM pg_constraint WHERE conrelid=expected;
 SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY pg_get_constraintdef(oid)) INTO right_shape FROM pg_constraint WHERE conrelid=actual;
 IF left_shape IS DISTINCT FROM right_shape THEN RAISE EXCEPTION 'MediaCleanupTask constraints mismatch'; END IF;
 SELECT jsonb_agg(shape ORDER BY shape::text) INTO left_shape FROM (
 SELECT jsonb_build_array(i.indisunique,i.indisprimary,i.indisvalid,i.indisready,am.amname,ARRAY(SELECT pg_get_indexdef(i.indexrelid,n,true) FROM generate_series(1,i.indnatts) n),pg_get_expr(i.indpred,i.indrelid)) AS shape FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_am am ON am.oid=c.relam WHERE i.indrelid=expected) x;
 SELECT jsonb_agg(shape ORDER BY shape::text) INTO right_shape FROM (
 SELECT jsonb_build_array(i.indisunique,i.indisprimary,i.indisvalid,i.indisready,am.amname,ARRAY(SELECT pg_get_indexdef(i.indexrelid,n,true) FROM generate_series(1,i.indnatts) n),pg_get_expr(i.indpred,i.indrelid)) AS shape FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_am am ON am.oid=c.relam WHERE i.indrelid=actual) x;
 IF left_shape IS DISTINCT FROM right_shape THEN RAISE EXCEPTION 'MediaCleanupTask indexes mismatch'; END IF;
END $verify$;

INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
 SELECT gen_random_uuid()::text,'02c72b464ff915bb60e77179531735507772fd5f73aa5456ae36b7cb0c0b1f09',now(),'20261031180000_media_cleanup_outbox',now(),0
 WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261031180000_media_cleanup_outbox');

SELECT migration_name,checksum,finished_at IS NOT NULL AS applied,applied_steps_count FROM "_prisma_migrations" WHERE migration_name='20261031180000_media_cleanup_outbox';

COMMIT;

