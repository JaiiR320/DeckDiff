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
