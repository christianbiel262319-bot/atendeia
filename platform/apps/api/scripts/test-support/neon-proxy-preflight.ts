import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { prisma } from "./neon-proxy-client.js";
const phase = process.argv[2] ?? "before";
const evidence = process.env.ATENDEIA_TEST_EVIDENCE_DIR;
if (!evidence) throw new Error("Missing evidence directory");
try {
  const migrations = await prisma.$queryRaw<
    Array<{ migration_name: string; checksum: string; applied: boolean }>
  >`
    SELECT migration_name,checksum,(finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied FROM "_prisma_migrations" ORDER BY started_at
  `;
  const root = new URL("../../prisma/migrations/", import.meta.url);
  const expected = readdirSync(root)
    .filter((name) => /^\d/u.test(name))
    .sort();
  if (
    migrations.length !== expected.length ||
    !expected.every((name) =>
      migrations.some(
        (row) =>
          row.migration_name === name &&
          row.applied &&
          row.checksum ===
            createHash("sha256")
              .update(readFileSync(new URL(`${name}/migration.sql`, root)))
              .digest("hex"),
      ),
    )
  ) {
    throw new Error(
      "Migration history does not match local files; no migration will be executed",
    );
  }
  const tables = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  const snapshots = [];
  for (const { tablename } of tables) {
    const identifier = `"${tablename.replaceAll('"', '""')}"`;
    const [row] = await prisma.$queryRawUnsafe<
      Array<{ count: number; digest: string }>
    >(
      `SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest FROM public.${identifier} t`,
    );
    snapshots.push({ table: tablename, ...row });
  }
  if (
    phase === "before" &&
    snapshots.some((row) => row.table === "MediaCleanupTask" && row.count !== 0)
  ) {
    throw new Error(
      "Cleanup queue is not empty: refusing to run global worker tests over pre-existing tasks",
    );
  }
  writeFileSync(
    `${evidence}/${phase}.json`,
    JSON.stringify(snapshots, null, 2),
  );
  if (phase === "after") {
    const before = JSON.parse(
      readFileSync(`${evidence}/before.json`, "utf8"),
    ) as typeof snapshots;
    const changed = snapshots.filter(
      (row) =>
        !before.some(
          (old) =>
            old.table === row.table &&
            old.count === row.count &&
            old.digest === row.digest,
        ),
    );
    if (changed.length)
      throw new Error(
        `Data preservation check failed: ${changed.map((row) => row.table).join(", ")}`,
      );
  }
  console.log(
    JSON.stringify({
      phase,
      tables: snapshots.length,
      migrations: migrations.length,
      dataPreserved: phase === "after" ? true : undefined,
    }),
  );
} finally {
  await prisma.$disconnect();
}
