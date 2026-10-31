import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
if (Number(process.versions.node.split(".")[0]) < 24) {
  throw new Error("This isolated test runner requires Node.js 24 or newer");
}
const databaseUrl = process.env.ATENDEIA_ACCEPTANCE_DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    "Configure ATENDEIA_ACCEPTANCE_DATABASE_URL securely in the test environment",
  );
const live = process.argv.includes("--cloudinary");
if (
  live &&
  (process.env.ATENDEIA_RUN_CLOUDINARY_LIVE !== "true" ||
    ![
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
      "ATENDEIA_CLOUDINARY_EXPECTED_CLOUD",
    ].every((key) => process.env[key]) ||
    process.env.ATENDEIA_CLOUDINARY_EXPECTED_CLOUD !==
      process.env.CLOUDINARY_CLOUD_NAME)
) {
  console.error(
    "Cloudinary live test not started: configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and ATENDEIA_CLOUDINARY_EXPECTED_CLOUD securely, then set ATENDEIA_RUN_CLOUDINARY_LIVE=true.",
  );
  process.exit(2);
}
const target = new URL(databaseUrl);
if (
  target.hostname !== "ep-aged-sea-afmt0kin.c-2.us-west-2.aws.neon.tech" ||
  target.pathname !== "/atendeia_homologacao"
)
  throw new Error("Refusing a target outside the isolated Neon test branch");
const cwd = fileURLToPath(new URL("../", import.meta.url));
const evidence = resolve(
  process.env.ATENDEIA_TEST_EVIDENCE_DIR ?? "test-evidence/neon",
);
mkdirSync(evidence, { recursive: true });
const preload = fileURLToPath(
  new URL("./test-support/register-neon-proxy.mjs", import.meta.url),
);
const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  ATENDEIA_DEPLOYMENT_STAGE: "homologation",
  ATENDEIA_TEST_NEON_WS: "true",
  ATENDEIA_TEST_BRANCH_ID: "br-red-term-aft504d9",
  ATENDEIA_RUN_POSTGRES_ACCEPTANCE: "true",
  ATENDEIA_RUN_MEDIA_POSTGRES_TESTS: "true",
  EXTERNAL_INTEGRATIONS_ENABLED: "false",
  COOKIE_SECURE: "false",
  LOG_LEVEL: "silent",
  ATENDEIA_TEST_EVIDENCE_DIR: evidence,
  JWT_ACCESS_SECRET: randomBytes(48).toString("base64url"),
  SECRETS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  APP_ORIGIN: "http://localhost:5173",
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${preload}`.trim(),
};
const sensitive = [
  databaseUrl,
  decodeURIComponent(target.password),
  process.env.CLOUDINARY_API_SECRET,
  process.env.CLOUDINARY_API_KEY,
  process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
    ? Buffer.from(
        `${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`,
      ).toString("base64")
    : undefined,
].filter(Boolean);
const redact = (s) =>
  sensitive.reduce(
    (text, value) => text.split(value).join("[REDACTED]"),
    String(s ?? ""),
  );
function run(command, args) {
  const r = spawnSync(command, args, {
    cwd,
    env: environment,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.stdout) process.stdout.write(redact(r.stdout));
  if (r.stderr) process.stderr.write(redact(r.stderr));
  if (r.error) throw new Error(redact(r.error.message));
  return r.status ?? 1;
}
// Read-only verification. Never calls migrate deploy, db push or manual schema SQL.
const pre = run("node", [
  "--import",
  "tsx",
  "scripts/test-support/neon-proxy-preflight.ts",
  "before",
]);
if (pre !== 0) process.exit(pre);
const tests = run("npm", [
  "exec",
  "--",
  "vitest",
  "run",
  "--config",
  live ? "vitest.cloudinary.config.ts" : "vitest.neon.config.ts",
  ...(process.argv.includes("--auth-only")
    ? ["tests/postgresql-homologation.integration.test.ts"]
    : process.argv.includes("--media-only")
      ? ["tests/media-cleanup-postgresql.integration.test.ts"]
      : []),
  "--reporter=verbose",
  "--reporter=json",
  `--outputFile=${evidence}/vitest.json`,
]);
const post = run("node", [
  "--import",
  "tsx",
  "scripts/test-support/neon-proxy-preflight.ts",
  "after",
]);
process.exitCode = tests || post;
