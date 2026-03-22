import { z } from "zod";

export const transcriptAnalysisSchema = z.object({
  pain_points: z.array(z.string()),
  customer_questions: z.array(z.string()),
  action_items: z.array(
    z.object({
      task: z.string(),
      owner: z.string().nullable(),
    }),
  ),
});

export type TranscriptAnalysis = z.infer<typeof transcriptAnalysisSchema>;

export const MAX_TRANSCRIPT_BYTES = 2 * 1024 * 1024;
