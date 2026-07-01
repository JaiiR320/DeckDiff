import type { DeckSave } from "#/lib/deck";
import {
  type CardCategory,
  mergeValidatedCardEntries,
  normalizeDeckCategories,
  type DeckCategory,
  type ValidatedDeckCard,
} from "#/lib/decklist";
import { buildAddedDeltaCards, buildEditorRows, groupEditorRows } from "./editorRows";
import type { CategoryDiff, DeckState } from "./types";

type BuildDeckEditorModelOptions = {
  baselineDeck: DeckState;
  baselineCategories: DeckCategory[];
  compareMode: boolean;
  compareSaves: { saveA: DeckSave; saveB: DeckSave } | null;
  categories: DeckCategory[];
  workingCards: ValidatedDeckCard[];
};

export function buildDeckEditorModel({
  baselineDeck,
  baselineCategories,
  compareMode,
  compareSaves,
  categories,
  workingCards,
}: BuildDeckEditorModelOptions) {
  const compareBaselineCards = compareSaves?.saveA.cards ?? baselineDeck.cards;
  const compareWorkingCards = compareSaves?.saveB.cards ?? workingCards;
  const compareBaselineCategories = compareSaves
    ? normalizeDeckCategories(compareSaves.saveA.categories)
    : baselineCategories;
  const compareWorkingCategories = compareSaves
    ? normalizeDeckCategories(compareSaves.saveB.categories)
    : categories;
  const mergedWorkingCards = mergeValidatedCardEntries(compareWorkingCards);
  const includedCategoryIds = new Set<CardCategory>();
  for (const category of compareWorkingCategories) {
    if (category.includeInDeck !== false) {
      includedCategoryIds.add(category.id);
    }
  }
  const editorRows = buildEditorRows(
    compareBaselineCards,
    compareWorkingCards,
    compareWorkingCategories,
    compareBaselineCategories,
  );
  const addedDeltaCards = buildAddedDeltaCards(
    compareBaselineCards,
    compareWorkingCards,
    compareWorkingCategories,
    compareBaselineCategories,
  );
  const categoryDiffs = buildCategoryDiffs(compareBaselineCategories, compareWorkingCategories);

  return {
    addedDeltaCards,
    categoryDiffs,
    emptyMessage:
      baselineDeck.status === "loading"
        ? "Validating the imported deck with Scryfall."
        : compareMode
          ? `Comparing "${compareSaves?.saveA.label}" → "${compareSaves?.saveB.label}"`
          : "Import a deck or add cards to start building.",
    groupedRows: groupEditorRows(editorRows, compareWorkingCategories),
    exportCategories: compareWorkingCategories,
    mergedWorkingCards,
    resultCardTotal: editorRows.reduce(
      (total, row) => total + (includedCategoryIds.has(row.category) ? row.currentQuantity : 0),
      0,
    ),
  };
}

function buildCategoryDiffs(baselineCategories: DeckCategory[], workingCategories: DeckCategory[]) {
  const baselineById = new Map(baselineCategories.map((category) => [category.id, category]));
  const diffs: Record<CardCategory, CategoryDiff> = {};

  for (const category of workingCategories) {
    const baselineCategory = baselineById.get(category.id);

    if (baselineCategory && baselineCategory.name !== category.name) {
      diffs[category.id] = { previousName: baselineCategory.name };
    }
  }

  return diffs;
}
