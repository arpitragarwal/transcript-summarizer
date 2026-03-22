import { z } from "zod";

/** One line of extraction with speaker and time when the transcript provides them. */
export const timestampedLineSchema = z.object({
  text: z.string(),
  speaker: z.string().nullable(),
  timestamp: z.string().nullable(),
});

export const transcriptAnalysisSchema = z.object({
  pain_points: z.array(timestampedLineSchema),
  customer_questions: z.array(timestampedLineSchema),
  action_items: z.array(
    z.object({
      task: z.string(),
      owner: z.string().nullable(),
      timestamp: z.string().nullable(),
    }),
  ),
});

export type TranscriptAnalysis = z.infer<typeof transcriptAnalysisSchema>;

export const MAX_TRANSCRIPT_BYTES = 2 * 1024 * 1024;
