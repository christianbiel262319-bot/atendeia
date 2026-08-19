import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const migrationPaths = [
  "../prisma/migrations/20260817010000_init/migration.sql",
  "../prisma/migrations/20260819090000_auth_lifecycle/migration.sql",
  "../prisma/migrations/20260819100000_tenant_relational_guards/migration.sql",
];

beforeAll(async () => {
  for (const path of migrationPaths) {
    await db.exec(readFileSync(new URL(path, import.meta.url), "utf8"));
  }
  await db.exec(`
    INSERT INTO "Tenant" ("id", "name", "slug", "updatedAt") VALUES
      ('00000000-0000-4000-8000-000000000001', 'Empresa A', 'empresa-a', NOW()),
      ('00000000-0000-4000-8000-000000000002', 'Empresa B', 'empresa-b', NOW());
    INSERT INTO "User" ("id", "email", "passwordHash", "fullName", "updatedAt") VALUES
      ('10000000-0000-4000-8000-000000000001', 'a@empresa.test', 'hash', 'Pessoa A', NOW()),
      ('10000000-0000-4000-8000-000000000002', 'b@empresa.test', 'hash', 'Pessoa B', NOW());
    INSERT INTO "Membership" ("id", "tenantId", "userId", "role", "updatedAt") VALUES
      ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'OWNER', NOW()),
      ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'OWNER', NOW());
    INSERT INTO "Contact" ("id", "tenantId", "whatsappUserId", "updatedAt") VALUES
      ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'whatsapp-a', NOW());
    INSERT INTO "Conversation" ("id", "tenantId", "contactId", "updatedAt") VALUES
      ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', NOW());
  `);
});

afterAll(async () => {
  await db.close();
});

describe("isolamento relacional no PostgreSQL", () => {
  it("impede a Empresa B de relacionar uma conversa ao contato da Empresa A", async () => {
    await expect(db.exec(`
      INSERT INTO "Conversation" ("id", "tenantId", "contactId", "updatedAt")
      VALUES ('40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', NOW());
    `)).rejects.toThrow();
  });

  it("impede a Empresa B de relacionar mensagem à conversa da Empresa A", async () => {
    await expect(db.exec(`
      INSERT INTO "Message" ("id", "tenantId", "conversationId", "direction", "sender", "status", "body", "updatedAt")
      VALUES ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'INBOUND', 'CUSTOMER', 'RECEIVED', 'teste', NOW());
    `)).rejects.toThrow();
  });

  it("impede atribuir conversa da Empresa A a membro da Empresa B", async () => {
    await expect(db.exec(`
      UPDATE "Conversation"
      SET "assignedMembershipId" = '20000000-0000-4000-8000-000000000002'
      WHERE "id" = '40000000-0000-4000-8000-000000000001';
    `)).rejects.toThrow();
  });
});
