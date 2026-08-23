import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../", import.meta.url);

function safetyCheck(environment) {
  return spawnSync(process.execPath, ["scripts/assert-preview-safety.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

test("the hosted visual preview is explicitly authorized", async () => {
  const script = await readFile(new URL("../scripts/build-site-preview.sh", import.meta.url), "utf8");
  assert.match(script, /ATENDEIA_DEPLOYMENT_STAGE="preview"/);
  assert.match(script, /VITE_ATENDEIA_STAGE="preview"/);
  assert.match(script, /VITE_ATENDEIA_PREVIEW="true"/);

  const result = safetyCheck({
    ATENDEIA_DEPLOYMENT_STAGE: "preview",
    VITE_ATENDEIA_STAGE: "preview",
    VITE_ATENDEIA_PREVIEW: "true",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /demo-enabled \(preview\)/);
});

test("a production build remains real-auth-only", () => {
  const result = safetyCheck({
    ATENDEIA_DEPLOYMENT_STAGE: "production",
    VITE_ATENDEIA_STAGE: "production",
    VITE_ATENDEIA_PREVIEW: "false",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /real-auth-only \(production\)/);
});

test("a homologation build uses only real authentication", () => {
  const result = safetyCheck({
    ATENDEIA_DEPLOYMENT_STAGE: "homologation",
    VITE_ATENDEIA_STAGE: "homologation",
    VITE_ATENDEIA_PREVIEW: "false",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /real-auth-only \(homologation\)/);
});

test("the build guard rejects a DEMO flag in production", () => {
  const result = safetyCheck({
    ATENDEIA_DEPLOYMENT_STAGE: "production",
    VITE_ATENDEIA_STAGE: "production",
    VITE_ATENDEIA_PREVIEW: "true",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /demo authentication bypass cannot be enabled outside development\/preview/);
});

test("the build guard rejects a DEMO flag in homologation", () => {
  const result = safetyCheck({
    ATENDEIA_DEPLOYMENT_STAGE: "homologation",
    VITE_ATENDEIA_STAGE: "homologation",
    VITE_ATENDEIA_PREVIEW: "true",
  });
  assert.equal(result.status, 1);
});
