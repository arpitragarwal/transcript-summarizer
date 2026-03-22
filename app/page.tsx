"use client";

import { useCallback, useState } from "react";
import type { TranscriptAnalysis } from "@/lib/transcript-schema";

function formatTs(ts: string | null): string {
  return ts?.trim() ? ts.trim() : "—";
}

function toMarkdown(data: TranscriptAnalysis): string {
  const lines: string[] = [
    "## Pain points (customer)",
    ...data.pain_points.map(
      (p) => `- **${formatTs(p.timestamp)}** ${p.text}`,
    ),
    "",
    "## Questions asked by customer",
    ...data.customer_questions.map(
      (q) => `- **${formatTs(q.timestamp)}** ${q.text}`,
    ),
    "",
    "## Action items",
    ...data.action_items.map((a) => {
      const owner = a.owner?.trim() ? a.owner : "Unassigned";
      return `- **${formatTs(a.timestamp)}** **${owner}**: ${a.task}`;
    }),
  ];
  return lines.join("\n");
}

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptAnalysis | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const submit = useCallback(async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const payload = (await res.json()) as
        | TranscriptAnalysis
        | { error?: string };
      if (!res.ok) {
        setError(
          "error" in payload && payload.error
            ? payload.error
            : `Request failed (${res.status})`,
        );
        return;
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !("pain_points" in payload)
      ) {
        setError("Unexpected response from server.");
        return;
      }
      setResult(payload as TranscriptAnalysis);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [text]);

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value === "string") setText(value);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const copyMd = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(result));
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [result]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-[family-name:var(--font-geist-sans)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Transcript summarizer
          </h1>
          <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <p>
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                Input:
              </span>{" "}
              A call transcript — paste the text or upload a{" "}
              <span className="whitespace-nowrap">.txt</span> file.
            </p>
            <p>
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                Output:
              </span>{" "}
              Customer pain points, questions they asked, and action items with
              owners when the transcript names them. Each row includes a
              transcript timestamp when the file has time markers, so you can
              jump back for context.
            </p>
            <p>
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                Try it:
              </span>{" "}
              Sample transcripts live in the repo’s{" "}
              <a
                href="https://github.com/arpitragarwal/transcript-summarizer/tree/main/test_data"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-100 dark:hover:text-neutral-300"
              >
                test_data
              </a>{" "}
              folder — open a file, copy the text, and paste here.
            </p>
          </div>
        </header>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-medium dark:border-neutral-600 dark:bg-neutral-900">
              <input
                type="file"
                accept=".txt,text/plain"
                className="sr-only"
                onChange={onFile}
              />
              Upload .txt
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={loading || !text.trim()}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {loading ? "Analyzing…" : "Summarize"}
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste transcript text here…"
            rows={14}
            className="w-full resize-y rounded-lg border border-neutral-300 bg-white p-3 text-sm leading-relaxed outline-none ring-neutral-400 focus:ring-2 dark:border-neutral-600 dark:bg-neutral-950 dark:ring-neutral-600"
          />
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
          >
            {error}
          </div>
        )}

        {result && (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Results</h2>
              <button
                type="button"
                onClick={copyMd}
                className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-300"
              >
                {copyState === "copied" ? "Copied" : "Copy as Markdown"}
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Pain points (customer)
              </h3>
              {result.pain_points.length === 0 ? (
                <p className="text-sm text-neutral-500">None identified.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/80">
                        <th className="w-[7.5rem] shrink-0 px-3 py-2 text-left font-semibold">
                          Time
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Pain point
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.pain_points.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                        >
                          <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs text-neutral-600 dark:text-neutral-400">
                            {row.timestamp?.trim() || "—"}
                          </td>
                          <td className="px-3 py-2">{row.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Questions asked by customer
              </h3>
              {result.customer_questions.length === 0 ? (
                <p className="text-sm text-neutral-500">None identified.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/80">
                        <th className="w-[7.5rem] shrink-0 px-3 py-2 text-left font-semibold">
                          Time
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Question
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.customer_questions.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                        >
                          <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs text-neutral-600 dark:text-neutral-400">
                            {row.timestamp?.trim() || "—"}
                          </td>
                          <td className="px-3 py-2">{row.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Action items
              </h3>
              {result.action_items.length === 0 ? (
                <p className="text-sm text-neutral-500">None identified.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/80">
                        <th className="w-[7.5rem] shrink-0 px-3 py-2 text-left font-semibold">
                          Time
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Owner
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Task
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.action_items.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                        >
                          <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs text-neutral-600 dark:text-neutral-400">
                            {row.timestamp?.trim() || "—"}
                          </td>
                          <td className="px-3 py-2 align-top text-neutral-700 dark:text-neutral-300">
                            {row.owner?.trim() || "—"}
                          </td>
                          <td className="px-3 py-2">{row.task}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
