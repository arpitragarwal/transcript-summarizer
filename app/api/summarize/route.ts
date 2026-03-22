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

Rules:
- pain_points: Problems, frustrations, gaps, or unmet needs expressed by the customer (not the vendor). Use concise bullet-style phrases. If none, return an empty array.
- customer_questions: Questions asked by the customer. Paraphrase only if needed for clarity; do not invent questions. If none, return an empty array.
- action_items: Commitments, follow-ups, or next steps mentioned. Each item has task (what) and owner (who is responsible: a person or team name). If ownership is not stated, set owner to null. Do not invent owners or tasks.

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
