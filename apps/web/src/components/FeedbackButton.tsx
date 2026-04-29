import { useState } from "react";
import type { FormEvent } from "react";
import { Bug, Check, Lightbulb, MessageSquarePlus, X } from "lucide-react";
import { createGithubIssue } from "#/server/github";

type IssueType = "bug" | "feature";

type SubmitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; issueNumber: number; issueUrl: string }
  | { status: "error"; message: string };

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [issueType, setIssueType] = useState<IssueType>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  function handleClose() {
    setIsOpen(false);
    setIssueType("bug");
    setTitle("");
    setBody("");
    setSubmitState({ status: "idle" });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) return;

    setSubmitState({ status: "loading" });
    try {
      const result = await createGithubIssue({
        data: { issueType, title: trimmedTitle, body: trimmedBody },
      });
      setSubmitState({
        status: "success",
        issueNumber: result.number,
        issueUrl: result.html_url,
      });
    } catch (err) {
      setSubmitState({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    }
  }

  const isLoading = submitState.status === "loading";

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        aria-label="Send feedback"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 shadow-lg shadow-black/40 transition hover:bg-zinc-700 hover:text-cyan-300"
      >
        <MessageSquarePlus className="h-5 w-5" strokeWidth={1.75} />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <button
            type="button"
            aria-label="Close feedback modal"
            className="absolute inset-0"
            onClick={handleClose}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-100">Send Feedback</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={handleClose}
                className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Success state */}
            {submitState.status === "success" ? (
              <div className="mt-6 flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-800 bg-cyan-950/50">
                  <Check className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-zinc-100">Issue created!</p>
                  <p className="mt-1 text-sm text-zinc-400">Thanks for your feedback.</p>
                </div>
                <a
                  href={submitState.issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
                >
                  View issue #{submitState.issueNumber} on GitHub
                </a>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
                >
                  Close
                </button>
              </div>
            ) : (
              /* Form state */
              <form className="mt-5" onSubmit={handleSubmit}>
                {/* Issue type selector */}
                <label className="block text-sm font-medium text-zinc-400">Type</label>
                <div className="mt-2 flex gap-2">
                  {(["bug", "feature"] as const).map((type) => {
                    const isActive = issueType === type;
                    const label = type === "bug" ? "Bug Report" : "Feature Request";
                    const Icon = type === "bug" ? Bug : Lightbulb;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setIssueType(type)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? "border-cyan-800 bg-cyan-950/40 text-cyan-200"
                            : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Title */}
                <label
                  className="mt-4 block text-sm font-medium text-zinc-400"
                  htmlFor="feedback-title"
                >
                  Title
                </label>
                <input
                  id="feedback-title"
                  autoFocus
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary"
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
                />

                {/* Description */}
                <label
                  className="mt-4 block text-sm font-medium text-zinc-400"
                  htmlFor="feedback-description"
                >
                  Description
                </label>
                <textarea
                  id="feedback-description"
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe the issue or feature in detail..."
                  rows={5}
                  className="mt-2 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
                />

                {/* Error message */}
                {submitState.status === "error" && (
                  <p className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-400">
                    {submitState.message}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !title.trim() || !body.trim()}
                    className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
