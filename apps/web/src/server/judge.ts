import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  type UnresolvedJudgeCardReference,
  fetchJudgeCardContexts,
  stripCardReferenceMarkup,
} from "#/lib/scryfall";

const judgeRequestSchema = z.object({
  question: z.string().trim().min(1, "Question is required."),
});

type JudgeBackendResponse = {
  answer?: unknown;
  response?: unknown;
  message?: unknown;
  output?: unknown;
  citations?: unknown;
  assumptions?: unknown;
  needsClarification?: unknown;
};

type ZenResponse = {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      text?: unknown;
    }>;
  }>;
  error?: {
    message?: unknown;
  };
};

type GeminiZenResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
      }>;
    };
  }>;
  error?: {
    message?: unknown;
  };
};

export type JudgeClarification = {
  originalQuestion: string;
  unresolvedCards: UnresolvedJudgeCardReference[];
};

export type JudgeAssistantResponse = {
  content: string;
  clarification: JudgeClarification | null;
};

const judgeModelResponseSchema = z.object({
  answer: z.string().trim().min(1),
  citations: z
    .array(
      z.object({
        rule: z.string().trim().min(1),
        excerpt: z.string().trim().min(1),
      }),
    )
    .default([]),
  assumptions: z.array(z.string().trim().min(1)).default([]),
  needsClarification: z.boolean().default(false),
});

const JUDGE_SYSTEM_PROMPT = `You are a Magic: The Gathering judge assistant.
Return JSON only with this exact shape:
{
  "answer": string,
  "citations": [{ "rule": string, "excerpt": string }],
  "assumptions": string[],
  "needsClarification": boolean
}

Rules:
- Use the provided card data and rulings as your primary source.
- Answer as clearly and directly as possible.
- If the question depends on missing context, set needsClarification to true and explain what is missing.
- Only include citations when you are confident the cited rule number and excerpt are accurate.
- If you are not confident about a citation, omit it instead of guessing.
- Return valid JSON only. Do not wrap it in markdown fences.`;

function getJudgeModel() {
  const configuredModel = process.env.JUDGE_MODEL?.trim() || "gemini-3.1-pro";
  return configuredModel.replace(/^opencode\//, "");
}

function getJudgeModelFamily(model: string) {
  if (model.startsWith("gemini-")) {
    return "gemini";
  }

  return "responses";
}

function extractZenResponseText(payload: ZenResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const outputText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((part) => (typeof part.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\n");

  return outputText?.trim() || null;
}

function parseJudgeModelResponse(text: string) {
  const candidates = [text];
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1]);
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    candidates.push(objectMatch[0]);
  }

  for (const candidate of candidates) {
    try {
      const parsed = judgeModelResponseSchema.safeParse(JSON.parse(candidate));
      if (parsed.success) {
        return parsed.data satisfies JudgeBackendResponse;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Judge model returned an invalid response format.");
}

function extractGeminiResponseText(payload: GeminiZenResponse) {
  const text = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => (typeof part.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\n");

  return text?.trim() || null;
}

function getJudgeResponseText(payload: JudgeBackendResponse) {
  const possibleText = [payload.answer, payload.response, payload.message, payload.output].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  if (!possibleText) {
    return null;
  }

  const sections = [possibleText.trim()];
  const citations = Array.isArray(payload.citations)
    ? payload.citations
        .filter(
          (citation): citation is { rule?: unknown; excerpt?: unknown } =>
            !!citation && typeof citation === "object",
        )
        .map((citation) => {
          const rule = typeof citation.rule === "string" ? citation.rule.trim() : "";
          const excerpt = typeof citation.excerpt === "string" ? citation.excerpt.trim() : "";
          if (!rule && !excerpt) {
            return null;
          }

          return rule ? `${rule}: ${excerpt}`.trim() : excerpt;
        })
        .filter((citation): citation is string => Boolean(citation))
    : [];

  if (citations.length > 0) {
    sections.push(`Citations:\n${citations.map((citation) => `- ${citation}`).join("\n")}`);
  }

  const assumptions = Array.isArray(payload.assumptions)
    ? payload.assumptions
        .filter(
          (assumption): assumption is string =>
            typeof assumption === "string" && assumption.trim().length > 0,
        )
        .map((assumption) => assumption.trim())
    : [];

  if (assumptions.length > 0) {
    sections.push(`Assumptions:\n${assumptions.map((assumption) => `- ${assumption}`).join("\n")}`);
  }

  if (payload.needsClarification === true) {
    sections.push("Needs clarification.");
  }

  return sections.join("\n\n");
}

export const sendJudgeQuestionToBackend = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => judgeRequestSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENCODE_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENCODE_API_KEY is not configured.");
    }

    const { cards, unresolved } = await fetchJudgeCardContexts(data.question);

    if (unresolved.length > 0) {
      const firstUnresolved = unresolved[0];
      const remainingCount = unresolved.length - 1;

      return {
        content:
          remainingCount > 0
            ? `I couldn't confidently match [[${firstUnresolved.name}]]. Pick one of these suggestions first. ${remainingCount} more card reference${remainingCount === 1 ? "" : "s"} will need confirmation after that.`
            : `I couldn't confidently match [[${firstUnresolved.name}]]. Pick one of these suggestions.`,
        clarification: {
          originalQuestion: data.question,
          unresolvedCards: unresolved,
        },
      } satisfies JudgeAssistantResponse;
    }

    const model = getJudgeModel();
    const questionPayload = {
      question: stripCardReferenceMarkup(data.question),
      cards,
    };

    if (getJudgeModelFamily(model) === "gemini") {
      const response = await fetch(`https://opencode.ai/zen/v1/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: JUDGE_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: JSON.stringify(questionPayload) }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as GeminiZenResponse | null;
        const errorMessage =
          typeof errorBody?.error?.message === "string" && errorBody.error.message.trim().length > 0
            ? errorBody.error.message.trim()
            : `OpenCode API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const payload = (await response.json()) as GeminiZenResponse;
      const responseText = extractGeminiResponseText(payload);
      if (!responseText) {
        throw new Error("OpenCode API returned an empty response.");
      }

      const modelResponse = parseJudgeModelResponse(responseText);
      return {
        content: getJudgeResponseText(modelResponse) ?? JSON.stringify(modelResponse),
        clarification: null,
      } satisfies JudgeAssistantResponse;
    }

    const response = await fetch("https://opencode.ai/zen/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: JUDGE_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(questionPayload),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as ZenResponse | null;
      const errorMessage =
        typeof errorBody?.error?.message === "string" && errorBody.error.message.trim().length > 0
          ? errorBody.error.message.trim()
          : `OpenCode API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    const payload = (await response.json()) as ZenResponse;
    const responseText = extractZenResponseText(payload);
    if (!responseText) {
      throw new Error("OpenCode API returned an empty response.");
    }

    const modelResponse = parseJudgeModelResponse(responseText);
    return {
      content: getJudgeResponseText(modelResponse) ?? JSON.stringify(modelResponse),
      clarification: null,
    } satisfies JudgeAssistantResponse;
  });
