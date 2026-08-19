import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../prisma/migrations/20260819100000_tenant_relational_guards/migration.sql", import.meta.url),
  "utf8",
);

describe("guardas relacionais de tenant", () => {
  it.each([
    'FOREIGN KEY ("tenantId", "contactId") REFERENCES "Contact"("tenantId", "id")',
    'FOREIGN KEY ("tenantId", "conversationId") REFERENCES "Conversation"("tenantId", "id")',
    'FOREIGN KEY ("tenantId", "subscriptionId") REFERENCES "Subscription"("tenantId", "id")',
    'FOREIGN KEY ("tenantId", "assignedMembershipId") REFERENCES "Membership"("tenantId", "id")',
  ])("impede relação cruzada: %s", (constraint) => {
    expect(migration).toContain(constraint);
  });

  it("interrompe a migration se já houver dados cruzados", () => {
    expect(migration).toContain("Existem relações cruzadas entre tenants");
  });
});
