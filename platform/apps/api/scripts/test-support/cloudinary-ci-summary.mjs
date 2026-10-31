import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const directory = process.env.ATENDEIA_TEST_EVIDENCE_DIR;
if (!directory) throw new Error("Missing test evidence directory");
const path = resolve(directory);
mkdirSync(path, { recursive: true });
function read(name) {
  try {
    const file = resolve(path, name);
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  } catch {
    return null;
  }
}
const report = read("vitest.json");
const before = read("before.json");
const after = read("after.json");
const manifest = read("cloudinary-manifest.json");
const availableSnapshots = Array.isArray(before) && Array.isArray(after);
const preserved = availableSnapshots
  ? before.length === after.length &&
    before.every((item) =>
      after.some(
        (other) =>
          item.table === other.table &&
          item.count === other.count &&
          item.digest === other.digest,
      ),
    )
  : null;
const outcome = process.env.ATENDEIA_CI_TEST_OUTCOME ?? "unknown";
const passed = Number.isInteger(report?.numPassedTests)
  ? report.numPassedTests
  : 0;
const failed = Number.isInteger(report?.numFailedTests)
  ? report.numFailedTests
  : 0;
const remaining = Array.isArray(manifest?.remaining) ? manifest.remaining : [];
const namespace =
  /^atendeia\/[a-f0-9-]{36}\/homologation-[a-f0-9-]{36}\/(shared|isolated)$/iu;
const summary = {
  scope: "Cloudinary real only; isolated Neon branch br-red-term-aft504d9",
  status:
    outcome === "success" &&
    passed > 0 &&
    failed === 0 &&
    preserved === true &&
    remaining.length === 0
      ? "passed"
      : report
        ? "failed_or_incomplete"
        : "not_executed",
  testsPassed: passed,
  testsFailed: failed,
  originalDataPreserved: preserved,
  tablesCompared: availableSnapshots ? before.length : null,
  disposableAssetsConfirmed: Array.isArray(manifest?.fixtures)
    ? manifest.fixtures.length
    : null,
  disposableAssetsRemaining: remaining.length,
  remainingDisposablePublicIds: remaining.filter(
    (id) => typeof id === "string" && namespace.test(id),
  ),
};
// Never publish provider responses, test failure payloads, credentials or database snapshots.
writeFileSync(
  resolve(path, "safe-summary.json"),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(JSON.stringify(summary));
