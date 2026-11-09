import { Alert } from "@jaiir320/design-system/components/alert";
import { Button } from "@jaiir320/design-system/components/button";
import { Textarea } from "@jaiir320/design-system/components/textarea";
import { useState } from "react";
import type { FormEvent } from "react";
import type { JudgeAssistantResponse, JudgeClarification } from "#/server/judge";

type JudgeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  clarification?: JudgeClarification | null;
  isPending?: boolean;
};

export type GetJudgeResponseInput = {
  message: string;
  messages: JudgeMessage[];
};

type JudgeChatProps = {
  getResponse: (input: GetJudgeResponseInput) => Promise<JudgeAssistantResponse>;
};

export function JudgeChat({ getResponse }: JudgeChatProps) {
  const [messages, setMessages] = useState<JudgeMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      content: "Thinking…",
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

  const isSendDisabled = isSubmitting || !draft.trim();

  return (
    <div className="mt-6 space-y-4">
      <div
        role="log"
        aria-label="Judge conversation"
        className="flex min-h-80 flex-col gap-3 rounded-2xl border border-border bg-surface/60 p-4"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-xl border px-4 py-3 text-sm ${
                message.role === "user"
                  ? "self-end border-info-border/60 bg-info-surface/30 text-cyan-100"
                  : "border-border bg-background text-strong-foreground"
              }`}
            >
              <p className="mb-1 text-xs font-medium uppercase tracking-eyebrow text-muted-foreground">
                {message.role}
              </p>
              <p className="whitespace-pre-wrap">{message.content}</p>

              {message.isPending ? (
                <p className="mt-2 text-xs text-muted-foreground">Judge model is thinking.</p>
              ) : null}

              {message.role === "assistant" && message.clarification?.unresolvedCards.length ? (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-xs uppercase tracking-eyebrow text-muted-foreground">
                    Did you mean
                  </p>
                  <p className="mt-1 text-sm text-subtle-foreground">
                    {message.clarification.unresolvedCards[0]?.name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.clarification.unresolvedCards[0]?.suggestions.map((suggestion) => (
                      <Button
                        key={suggestion}
                        size="xs"
                        onClick={() => void handleSuggestionClick(message, suggestion)}
                        className="rounded-lg border-border-strong text-strong-foreground hover:border-ring hover:bg-transparent hover:text-selected-foreground"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {errorMessage ? (
        <Alert tone="destructive" role="alert">
          {errorMessage}
        </Alert>
      ) : null}

      <form className="space-y-3" onSubmit={handleSubmit}>
        <Textarea
          aria-label="Message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type your message"
          rows={4}
          className="resize-y"
        />
        <div className="flex justify-end">
          <Button type="submit" variant="default" disabled={isSendDisabled}>
            {isSubmitting ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
