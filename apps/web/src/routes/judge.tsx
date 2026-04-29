import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getCurrentSession } from "#/server/session";
import {
  type JudgeAssistantResponse,
  type JudgeClarification,
  sendJudgeQuestionToBackend,
} from "#/server/judge";

type JudgeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  clarification?: JudgeClarification | null;
  isPending?: boolean;
};

type GetJudgeResponseInput = {
  message: string;
  messages: JudgeMessage[];
};

type JudgeChatProps = {
  getResponse: (input: GetJudgeResponseInput) => Promise<JudgeAssistantResponse>;
};

export const Route = createFileRoute("/judge")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
  },
  component: JudgePage,
});

function JudgePage() {
  async function getResponse({ message }: GetJudgeResponseInput) {
    return sendJudgeQuestionToBackend({
      data: {
        question: message,
      },
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl shadow-black/20">
        <div className="border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-semibold text-zinc-100">Judge</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Reference cards with <code>[[Card Name]]</code>.
          </p>
        </div>

        <JudgeChat getResponse={getResponse} />
      </section>
    </main>
  );
}

function JudgeChat({ getResponse }: JudgeChatProps) {
  const [messages, setMessages] = useState<JudgeMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  async function submitQuestion(question: string) {
    const message = question.trim();
    if (!message || isSubmitting) {
      return;
    }

    const userMessage: JudgeMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraft("");
    setErrorMessage(null);
    setIsSubmitting(true);

    const pendingAssistantMessage: JudgeMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Thinking...",
      isPending: true,
    };

    setMessages([...nextMessages, pendingAssistantMessage]);

    try {
      const response = await getResponse({
        message,
        messages: nextMessages,
      });

      setMessages([
        ...nextMessages,
        {
          id: pendingAssistantMessage.id,
          role: "assistant",
          content: response.content,
          clarification: response.clarification,
        },
      ]);
    } catch (error) {
      setMessages(nextMessages);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not get a response right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSubmitting) {
      return;
    }

    await submitQuestion(message);
  }

  async function handleSuggestionClick(message: JudgeMessage, suggestion: string) {
    const unresolvedCard = message.clarification?.unresolvedCards[0];
    const originalQuestion = message.clarification?.originalQuestion;

    if (!unresolvedCard || !originalQuestion) {
      return;
    }

    const escapedName = unresolvedCard.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const updatedQuestion = originalQuestion.replace(
      new RegExp(`\\[\\[\\s*${escapedName}\\s*\\]\\]`),
      `[[${suggestion}]]`,
    );

    setMessages((currentMessages) =>
      currentMessages.filter((currentMessage) => currentMessage.id !== message.id),
    );
    await submitQuestion(updatedQuestion);
  }

  const isSendDisabled = !hasHydrated || isSubmitting || !draft.trim();

  return (
    <div className="mt-6 space-y-4">
      <div className="flex min-h-80 flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">No messages yet.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-xl border px-4 py-3 text-sm ${
                message.role === "user"
                  ? "self-end border-cyan-900/60 bg-cyan-950/30 text-cyan-100"
                  : "border-zinc-800 bg-zinc-950 text-zinc-200"
              }`}
            >
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                {message.role}
              </p>
              <p className="whitespace-pre-wrap">{message.content}</p>

              {message.isPending ? (
                <p className="mt-2 text-xs text-zinc-500">Judge model is thinking.</p>
              ) : null}

              {message.role === "assistant" && message.clarification?.unresolvedCards.length ? (
                <div className="mt-3 border-t border-zinc-800 pt-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Did you mean</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {message.clarification.unresolvedCards[0]?.name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.clarification.unresolvedCards[0]?.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void handleSuggestionClick(message, suggestion)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-cyan-500 hover:text-cyan-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          {errorMessage}
        </p>
      ) : null}

      <form className="space-y-3" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type your message"
          rows={4}
          className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSendDisabled}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
