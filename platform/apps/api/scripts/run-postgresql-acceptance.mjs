import { spawnSync } from "node:child_process";

const databaseUrl = process.env.ATENDEIA_ACCEPTANCE_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Defina ATENDEIA_ACCEPTANCE_DATABASE_URL para um PostgreSQL exclusivo de teste");
}

const parsed = new URL(databaseUrl);
const databaseName = parsed.pathname.replace(/^\//u, "").toLowerCase();
if (!/(test|homolog|hml)/u.test(databaseName)) {
  throw new Error("O nome do banco de aceitação deve conter test, homolog ou hml");
}

const environment = {
  ...process.env,
  NODE_ENV: "test",
  ATENDEIA_DEPLOYMENT_STAGE: "homologation",
  EXTERNAL_INTEGRATIONS_ENABLED: "false",
  DATABASE_URL: databaseUrl,
  ATENDEIA_RUN_POSTGRES_ACCEPTANCE: "true",
  COOKIE_SECURE: "false",
};

run("npm", ["exec", "--", "prisma", "migrate", "deploy"], environment);
run(
  "npm",
  ["exec", "--", "vitest", "run", "tests/postgresql-homologation.integration.test.ts", "--reporter=verbose"],
  environment,
);

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
