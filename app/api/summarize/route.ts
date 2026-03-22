import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import {
  MAX_TRANSCRIPT_BYTES,
  transcriptAnalysisSchema,
} from "@/lib/transcript-schema";

/** Vercel Hobby caps serverless time at 60s; raise this on Pro if you need longer runs. */
export const maxDuration = 60;

const SYSTEM_PROMPT = `You analyze sales and support call transcripts. Extract structured information only from what is clearly stated or strongly implied in the transcript.

Timestamps (required on every item):
- For each pain point, question, and action item, set "timestamp" to the time marker from the transcript that best locates that moment (copy the format used in the transcript: e.g. [00:12:34], 12:34, 1:02:15, or a line prefix).
- Use the timestamp on the same line or the nearest preceding timestamp/speaker block for that content.
- If the transcript contains no time markers anywhere, set timestamp to null for all items.
- Never invent a fake clock time; only use what appears in the text or null.

Speaker (pain_points and customer_questions only):
- Set "speaker" to the name or label from the transcript for the person saying that line (e.g. "Sarah", "Customer", "John D."). Use the same wording as in the file when possible.
- If the transcript does not label speakers or you cannot tell, set speaker to null. Do not invent names.

Rules:
- pain_points: Objects with "text" (concise customer-side problems/frustrations/gaps), "speaker", and "timestamp" as above. If none, return an empty array.
- customer_questions: Objects with "text" (customer questions; paraphrase only if needed), "speaker" (who asked), and "timestamp". If none, return an empty array.
- action_items: "task", "owner" (person/team or null if unstated), and "timestamp". Do not invent owners or tasks.

Do not hallucinate. Prefer empty arrays and null over guessing.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is not configured with OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const transcript =
    typeof body === "object" &&
    body !== null &&
    "transcript" in body &&
    typeof (body as { transcript: unknown }).transcript === "string"
      ? (body as { transcript: string }).transcript
      : null;

  if (transcript === null) {
    return NextResponse.json(
      { error: "Request body must include a string field \"transcript\"." },
      { status: 400 },
    );
  }

  const trimmed = transcript.trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: "Transcript is empty after trimming." },
      { status: 400 },
    );
  }

  const byteLength = Buffer.byteLength(trimmed, "utf8");
  if (byteLength > MAX_TRANSCRIPT_BYTES) {
    return NextResponse.json(
      {
        error: `Transcript exceeds maximum size (${MAX_TRANSCRIPT_BYTES} bytes).`,
      },
      { status: 400 },
    );
  }

  const openai = new OpenAI({
    apiKey,
    timeout: 58_000,
    maxRetries: 1,
  });

  try {
    const completion = await openai.chat.completions.parse({
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Call transcript:\n\n${trimmed}`,
        },
      ],
      response_format: zodResponseFormat(
        transcriptAnalysisSchema,
        "transcript_analysis",
      ),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      const refusal = completion.choices[0]?.message.refusal;
      return NextResponse.json(
        {
          error: refusal ?? "The model did not return structured output.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Analysis request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
