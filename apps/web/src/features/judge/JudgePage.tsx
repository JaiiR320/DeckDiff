import { Card } from "@jaiir320/design-system/components/card";
import { JudgeChat, type GetJudgeResponseInput } from "./JudgeChat";
import { sendJudgeQuestionToBackend } from "#/server/judge";

async function getResponse({ message }: GetJudgeResponseInput) {
  return sendJudgeQuestionToBackend({
    data: {
      question: message,
    },
  });
}

export function JudgePage() {
  return (
    <main className="mx-auto w-full p-8">
      <Card
        render={<section />}
        variant="glass"
        padding="lg"
        className="rounded-2xl bg-surface-glass/70 shadow-2xl shadow-black/20"
      >
        <div className="border-b border-border pb-4">
          <h1 className="text-2xl font-semibold text-foreground">Judge</h1>
          <p className="mt-1 text-sm text-subtle-foreground">
            Reference cards with <code>[[Card Name]]</code>.
          </p>
        </div>

        <JudgeChat getResponse={getResponse} />
      </Card>
    </main>
  );
}
