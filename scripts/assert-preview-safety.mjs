const stage = process.env.ATENDEIA_DEPLOYMENT_STAGE ?? "production";
const publicStage = process.env.VITE_ATENDEIA_STAGE ?? stage;
const previewEnabled = process.env.VITE_ATENDEIA_PREVIEW === "true";
const allowedStages = new Set(["development", "preview", "production"]);

if (!allowedStages.has(stage) || !allowedStages.has(publicStage)) {
  console.error("AtendeIA build blocked: invalid deployment stage.");
  process.exit(1);
}

if (publicStage !== stage) {
  console.error("AtendeIA build blocked: public and private deployment stages do not match.");
  process.exit(1);
}

if (previewEnabled && stage !== "development" && stage !== "preview") {
  console.error("AtendeIA build blocked: demo authentication bypass cannot be enabled in production.");
  process.exit(1);
}

console.log(`AtendeIA build mode: ${previewEnabled ? "demo-enabled" : "real-auth-only"} (${stage}).`);
