CREATE TYPE "ContactSource" AS ENUM ('WHATSAPP', 'MANUAL', 'IMPORT', 'API');

ALTER TABLE "Contact"
  ADD COLUMN "source" "ContactSource" NOT NULL DEFAULT 'WHATSAPP',
  ADD COLUMN "lastInteractionAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "Contact"
SET "phoneE164" = '+' || "phoneE164"
WHERE "phoneE164" ~ '^[1-9][0-9]{7,14}$';

UPDATE "Contact" contact
SET "lastInteractionAt" = activity."lastInteractionAt"
FROM (
  SELECT "contactId", MAX("updatedAt") AS "lastInteractionAt"
  FROM "Conversation"
  GROUP BY "contactId"
) activity
WHERE contact."id" = activity."contactId";

DROP INDEX "Contact_tenantId_createdAt_idx";
CREATE INDEX "Contact_tenantId_archivedAt_updatedAt_idx" ON "Contact"("tenantId", "archivedAt", "updatedAt");
CREATE INDEX "Contact_tenantId_lastInteractionAt_idx" ON "Contact"("tenantId", "lastInteractionAt");

ALTER TABLE "Product"
  ADD COLUMN "category" VARCHAR(80),
  ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "imageAssetId" UUID;

ALTER TABLE "Service"
  ADD COLUMN "category" VARCHAR(80),
  ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Faq"
  ADD COLUMN "category" VARCHAR(80);

CREATE TABLE "CompanyProfile" (
  "tenantId" UUID NOT NULL,
  "description" TEXT,
  "address" TEXT,
  "phoneE164" VARCHAR(20),
  "email" VARCHAR(254),
  "policies" TEXT,
  "usefulLinks" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("tenantId")
);

CREATE TABLE "BusinessHourException" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "label" VARCHAR(120),
  "opensAt" CHAR(5),
  "closesAt" CHAR(5),
  "isClosed" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessHourException_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactNote" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "contactId" UUID NOT NULL,
  "authorUserId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_tenantId_id_key" ON "MediaAsset"("tenantId", "id");
CREATE UNIQUE INDEX "BusinessHourException_tenantId_date_key" ON "BusinessHourException"("tenantId", "date");
CREATE INDEX "BusinessHourException_tenantId_date_idx" ON "BusinessHourException"("tenantId", "date");
CREATE INDEX "ContactNote_tenantId_contactId_createdAt_idx" ON "ContactNote"("tenantId", "contactId", "createdAt");

ALTER TABLE "CompanyProfile"
ADD CONSTRAINT "CompanyProfile_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessHourException"
ADD CONSTRAINT "BusinessHourException_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactNote"
ADD CONSTRAINT "ContactNote_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactNote"
ADD CONSTRAINT "ContactNote_tenantId_contactId_fkey"
FOREIGN KEY ("tenantId", "contactId") REFERENCES "Contact"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactNote"
ADD CONSTRAINT "ContactNote_tenantId_authorUserId_fkey"
FOREIGN KEY ("tenantId", "authorUserId") REFERENCES "Membership"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product"
ADD CONSTRAINT "Product_tenantId_imageAssetId_fkey"
FOREIGN KEY ("tenantId", "imageAssetId") REFERENCES "MediaAsset"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
