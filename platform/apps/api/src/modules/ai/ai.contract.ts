import { z } from "zod";

export const aiAnswerSchema = z.object({
  answer: z.string().min(1).max(3000),
  canAnswer: z.boolean(),
  confidence: z.number().min(0).max(1),
  needsHuman: z.boolean(),
  reason: z.string().min(1).max(240),
});

export type AiAnswer = z.infer<typeof aiAnswerSchema>;

export function applyConfidencePolicy(
  answer: AiAnswer,
  minimumConfidence: number,
  transferMessage: string,
): AiAnswer {
  if (answer.canAnswer && !answer.needsHuman && answer.confidence >= minimumConfidence) {
    return answer;
  }
  return {
    answer: transferMessage,
    canAnswer: false,
    confidence: answer.confidence,
    needsHuman: true,
    reason: answer.reason,
  };
}
