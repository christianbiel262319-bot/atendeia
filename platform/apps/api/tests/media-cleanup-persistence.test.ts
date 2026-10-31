import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

// Supplemental embedded-engine check; this does NOT replace real PostgreSQL acceptance.
it("persists cleanup intent across reopen, rolls it back atomically and preserves referenced media", async () => {
  const dir = mkdtempSync(join(tmpdir(), "atendeia-cleanup-"));
  let db = new PGlite(dir);
  const tenant = "00000000-0000-4000-8000-000000000001";
  const user = "10000000-0000-4000-8000-000000000001";
  const asset = "20000000-0000-4000-8000-000000000001";
  const product = "30000000-0000-4000-8000-000000000001";
  const task = "40000000-0000-4000-8000-000000000001";
  try {
    const root = new URL("../prisma/migrations/", import.meta.url);
    for (const name of readdirSync(root).filter((name) => /^\d/u.test(name)).sort()) {
      await db.exec(readFileSync(new URL(`${name}/migration.sql`, root), "utf8"));
    }
    await db.exec(`
      INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('${tenant}','Test','cleanup-test',NOW());
      INSERT INTO "User" (id,email,"passwordHash","fullName","updatedAt") VALUES ('${user}','cleanup@example.test','hash','Test',NOW());
      INSERT INTO "MediaAsset" (id,"tenantId","createdByUserId","publicId","secureUrl","resourceType","updatedAt")
        VALUES ('${asset}','${tenant}','${user}','atendeia/${tenant}/image','https://example.test/image','image',NOW());
      INSERT INTO "Product" (id,"tenantId",name,description,"imageAssetId","updatedAt") VALUES ('${product}','${tenant}','Test','Test description','${asset}',NOW());
    `);
    await expect(db.exec(`DELETE FROM "MediaAsset" WHERE id='${asset}'`)).rejects.toThrow();
    const enqueue = `INSERT INTO "MediaCleanupTask" (id,"tenantId","mediaAssetId","publicId","resourceType","updatedAt") VALUES ('${task}','${tenant}','${asset}','atendeia/${tenant}/image','image',NOW())`;
    await db.exec(`BEGIN; UPDATE "Product" SET "imageAssetId"=NULL WHERE id='${product}'; ${enqueue}; ROLLBACK;`);
    expect((await db.query('SELECT * FROM "MediaCleanupTask"')).rows).toHaveLength(0);
    expect((await db.query<{ imageAssetId: string }>('SELECT "imageAssetId" FROM "Product"')).rows[0]?.imageAssetId).toBe(asset);
    await db.exec(`BEGIN; UPDATE "Product" SET "imageAssetId"=NULL WHERE id='${product}'; ${enqueue}; COMMIT;`);
    await db.close();
    db = new PGlite(dir);
    expect((await db.query('SELECT * FROM "MediaCleanupTask"')).rows).toHaveLength(1);
    await db.exec(`BEGIN; DELETE FROM "MediaAsset" WHERE id='${asset}'; UPDATE "MediaCleanupTask" SET "retiredAt"=NOW() WHERE id='${task}'; COMMIT;`);
    await expect(db.exec(`UPDATE "Product" SET "imageAssetId"='${asset}' WHERE id='${product}'`)).rejects.toThrow();
    await db.close();
    db = new PGlite(dir);
    const rows = (await db.query<{ retiredAt: unknown; completedAt: unknown }>('SELECT "retiredAt","completedAt" FROM "MediaCleanupTask"')).rows;
    expect(rows[0]?.retiredAt).not.toBeNull();
    expect(rows[0]?.completedAt).toBeNull();
  } finally {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);
