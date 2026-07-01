import { getLatestSave, slugifyName, type DeckItem } from "./deck";
import {
  formatDecklist,
  normalizeDeckCategories,
  type DeckCategory,
  type DeckExportOptions,
  type ValidatedDeckCard,
} from "./decklist";

const DEFAULT_EXPORT_OPTIONS: DeckExportOptions = {
  includeQuantity: true,
  includeSet: false,
  includeCollectorNumber: false,
  setStyle: "brackets",
  groupByCategory: false,
  includeOutOfDeckCategories: false,
  separateSideboard: false,
};

type DeckExportSource = {
  cards?: ValidatedDeckCard[];
  categories?: DeckCategory[];
  groupByCategory?: boolean;
  includeOutOfDeckCategories?: boolean;
};

export type DeckExportResult =
  | { ok: true; filename: string; text: string }
  | { ok: false; reason: string };

export function createDeckExport(
  deck: DeckItem,
  options: Partial<DeckExportOptions> & DeckExportSource = {},
): DeckExportResult {
  const cards = getExportableDeckCards(deck, options);
  if (cards.length === 0) {
    return { ok: false, reason: "No cards to export. Import or add cards first." };
  }

  return {
    ok: true,
    filename: `${slugifyName(deck.name) || "deck"}.txt`,
    text: formatDecklist(cards, {
      ...DEFAULT_EXPORT_OPTIONS,
      deckName: deck.name,
      categories: deck.categories ?? getLatestSave(deck)?.categories,
      ...options,
    }),
  };
}

export function getExportableDeckCards(deck: DeckItem, source: DeckExportSource = {}) {
  const latestSave = getLatestSave(deck);
  const cards = source.cards ?? deck.cards ?? latestSave?.cards ?? [];
  const categories = source.categories ?? deck.categories ?? latestSave?.categories;

  if (!categories) {
    return cards;
  }

  const includedCategoryIds = new Set<string>();
  for (const category of normalizeDeckCategories(categories)) {
    if (
      category.includeInDeck !== false ||
      (source.groupByCategory && source.includeOutOfDeckCategories)
    ) {
      includedCategoryIds.add(category.id);
    }
  }

  return cards.filter((card) => includedCategoryIds.has(card.categoryId ?? ""));
}
