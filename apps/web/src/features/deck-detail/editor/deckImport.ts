import {
  mergeValidatedCardEntries,
  type InvalidDeckCard,
  type ValidatedDeckCard,
} from "#/lib/decklist";
import type { DeckState } from "./types";

export type ImportMode = "replace-empty" | "bulk-add" | "override";

type ApplyValidatedDeckImportOptions = {
  mode: ImportMode;
  baselineDeck: DeckState;
  workingCards: ValidatedDeckCard[];
  validCards: ValidatedDeckCard[];
  warnings: InvalidDeckCard[];
  rawText: string;
};

export function applyValidatedDeckImport({
  mode,
  baselineDeck,
  workingCards,
  validCards,
  warnings,
  rawText,
}: ApplyValidatedDeckImportOptions) {
  if (mode === "bulk-add") {
    return {
      baselineDeck: {
        ...baselineDeck,
        invalidCards: warnings,
        status: "ready" as const,
        errorMessage: null,
      },
      workingCards: mergeValidatedCardEntries([...workingCards, ...validCards]),
    };
  }

  if (mode === "override") {
    return {
      baselineDeck: {
        rawText: "",
        cards: workingCards,
        invalidCards: warnings,
        status: "ready" as const,
        errorMessage: null,
      },
      workingCards: validCards,
    };
  }

  return {
    baselineDeck: {
      rawText,
      cards: validCards,
      invalidCards: warnings,
      status: "ready" as const,
      errorMessage: null,
    },
    workingCards: validCards,
  };
}
