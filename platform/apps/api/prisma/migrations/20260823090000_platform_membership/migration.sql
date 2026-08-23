-- Platform authorization is deliberately independent from tenant roles.
CREATE TYPE "PlatformRole" AS ENUM ('OWNER');

CREATE TABLE "PlatformMembership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'OWNER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "targetUserId" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformMembership_userId_key" ON "PlatformMembership"("userId");
CREATE INDEX "PlatformMembership_role_active_idx" ON "PlatformMembership"("role", "active");
CREATE INDEX "PlatformAuditLog_targetUserId_createdAt_idx" ON "PlatformAuditLog"("targetUserId", "createdAt");
CREATE INDEX "PlatformAuditLog_action_createdAt_idx" ON "PlatformAuditLog"("action", "createdAt");

ALTER TABLE "PlatformMembership"
ADD CONSTRAINT "PlatformMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformAuditLog"
ADD CONSTRAINT "PlatformAuditLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlatformAuditLog"
ADD CONSTRAINT "PlatformAuditLog_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve existing explicitly promoted operators while moving authorization
-- away from the legacy User.isSuperAdmin flag.
INSERT INTO "PlatformMembership" ("id", "userId", "role", "active", "updatedAt")
SELECT gen_random_uuid(), "id", 'OWNER'::"PlatformRole", true, CURRENT_TIMESTAMP
FROM "User"
WHERE "isSuperAdmin" = true
ON CONFLICT ("userId") DO NOTHING;
