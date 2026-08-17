import { describe, expect, it } from "vitest";
import { applyConfidencePolicy } from "../src/modules/ai/ai.contract.js";

describe("AI confidence policy", () => {
  it("keeps a grounded answer above the tenant threshold", () => {
    const answer = { answer: "Abrimos às 9h.", canAnswer: true, confidence: 0.92, needsHuman: false, reason: "HOURS_FOUND" };
    expect(applyConfidencePolicy(answer, 0.8, "Transferindo")).toEqual(answer);
  });

  it("forces a human handoff below the threshold", () => {
    expect(
      applyConfidencePolicy(
        { answer: "Talvez.", canAnswer: true, confidence: 0.55, needsHuman: false, reason: "LOW_CONTEXT" },
        0.8,
        "Transferindo",
      ),
    ).toEqual({ answer: "Transferindo", canAnswer: false, confidence: 0.55, needsHuman: true, reason: "LOW_CONTEXT" });
  });
});
