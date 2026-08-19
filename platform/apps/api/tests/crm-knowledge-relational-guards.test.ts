import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../prisma/migrations/20260819110000_crm_knowledge_expansion/migration.sql", import.meta.url),
  "utf8",
);

describe("guardas relacionais de CRM e conhecimento", () => {
  it.each([
    'FOREIGN KEY ("tenantId", "contactId") REFERENCES "Contact"("tenantId", "id")',
    'FOREIGN KEY ("tenantId", "authorUserId") REFERENCES "Membership"("tenantId", "userId")',
    'FOREIGN KEY ("tenantId", "imageAssetId") REFERENCES "MediaAsset"("tenantId", "id")',
  ])("impede relação cruzada: %s", (constraint) => {
    expect(migration).toContain(constraint);
  });
});
