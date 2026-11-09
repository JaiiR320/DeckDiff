import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  type UnresolvedJudgeCardReference,
  fetchJudgeCardContexts,
  stripCardReferenceMarkup,
} from "#/lib/scryfall";
import { requestJudgeModel } from "./judgeModelClient";
import { getJudgeResponseText } from "./judgeResponseParsing";

const judgeRequestSchema = z.object({
  question: z.string().trim().min(1, "Question is required."),
});

export type JudgeClarification = {
  originalQuestion: string;
  unresolvedCards: UnresolvedJudgeCardReference[];
};

export type JudgeAssistantResponse = {
  content: string;
  clarification: JudgeClarification | null;
};

function getUnresolvedCardResponse(
  question: string,
  unresolved: UnresolvedJudgeCardReference[],
): JudgeAssistantResponse {
  const firstUnresolved = unresolved[0];
  const remainingCount = unresolved.length - 1;

  return {
    content:
      remainingCount > 0
        ? `I couldn't confidently match [[${firstUnresolved.name}]]. Pick one of these suggestions first. ${remainingCount} more card reference${remainingCount === 1 ? "" : "s"} will need confirmation after that.`
        : `I couldn't confidently match [[${firstUnresolved.name}]]. Pick one of these suggestions.`,
    clarification: {
      originalQuestion: question,
      unresolvedCards: unresolved,
    },
  };
}

export const sendJudgeQuestionToBackend = createServerFn({ method: "POST" })
  .validator((data: unknown) => judgeRequestSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENCODE_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENCODE_API_KEY is not configured.");
    }

    const { cards, unresolved } = await fetchJudgeCardContexts(data.question);

    if (unresolved.length > 0) {
      return getUnresolvedCardResponse(data.question, unresolved);
    }

    const modelResponse = await requestJudgeModel(apiKey, {
      question: stripCardReferenceMarkup(data.question),
      cards,
    });

    return {
      content: getJudgeResponseText(modelResponse) ?? JSON.stringify(modelResponse),
      clarification: null,
    } satisfies JudgeAssistantResponse;
  });
