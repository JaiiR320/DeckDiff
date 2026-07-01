import {
  type CardCategory,
  deckCardEntryKey,
  defaultDeckCategories,
  normalizeDeckCard,
  type DeckCategory,
  mergeValidatedCardEntries,
  type ValidatedDeckCard,
} from "#/lib/decklist";
import type { EditorRow } from "./types";

export function buildEditorRows(
  baselineCards: ValidatedDeckCard[],
  workingCards: ValidatedDeckCard[],
  categories: DeckCategory[] = defaultDeckCategories(),
  baselineCategories: DeckCategory[] = categories,
) {
  const baseline = mergeValidatedCardEntries(
    baselineCards.map((card) => normalizeDeckCard(card, baselineCategories)),
  );
  const working = mergeValidatedCardEntries(
    workingCards.map((card) => normalizeDeckCard(card, categories)),
  );
  const categoryOrder = new Map(categories.map((category, index) => [category.id, index]));
  const baselineById = new Map(baseline.map((card) => [diffCardKey(card), card]));
  const workingById = new Map(working.map((card) => [diffCardKey(card), card]));
  const allIds = new Set([...baselineById.keys(), ...workingById.keys()]);
  const rows: EditorRow[] = [];

  for (const diffKey of allIds) {
    const baselineCard = baselineById.get(diffKey);
    const workingCard = workingById.get(diffKey);
    const displayCard = workingCard ?? baselineCard;
    const baselineQuantity = baselineCard?.quantity ?? 0;
    const currentQuantity = workingCard?.quantity ?? 0;

    rows.push({
      oracleId: workingCard?.oracleId ?? baselineCard?.oracleId ?? "",
      name: workingCard?.name ?? baselineCard?.name ?? "Unknown Card",
      category: workingCard?.categoryId ?? baselineCard?.categoryId ?? "other",
      typeLine: workingCard?.typeLine ?? baselineCard?.typeLine ?? "",
      manaCost: workingCard?.manaCost ?? baselineCard?.manaCost,
      manaValue: workingCard?.manaValue ?? baselineCard?.manaValue ?? 0,
      producedMana: workingCard?.producedMana ?? baselineCard?.producedMana,
      setCode: workingCard?.setCode ?? baselineCard?.setCode,
      collectorNumber: workingCard?.collectorNumber ?? baselineCard?.collectorNumber,
      smallImageUrl: workingCard?.smallImageUrl ?? baselineCard?.smallImageUrl,
      imageUrl: workingCard?.imageUrl ?? baselineCard?.imageUrl,
      faces: workingCard?.faces ?? baselineCard?.faces,
      priceUsd: workingCard?.priceUsd ?? baselineCard?.priceUsd,
      edhrecRank: displayCard?.edhrecRank ?? null,
      baselineQuantity,
      currentQuantity,
      status:
        baselineQuantity === 0
          ? "added"
          : currentQuantity === 0
            ? "removed"
            : baselineQuantity !== currentQuantity
              ? "changed"
              : "same",
    });
  }

  return rows.sort((left, right) => {
    const categoryCompare =
      (categoryOrder.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
      (categoryOrder.get(right.category) ?? Number.MAX_SAFE_INTEGER);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

export function buildAddedDeltaCards(
  baselineCards: ValidatedDeckCard[],
  workingCards: ValidatedDeckCard[],
  categories: DeckCategory[] = defaultDeckCategories(),
  baselineCategories: DeckCategory[] = categories,
) {
  const baseline = mergeValidatedCardEntries(
    baselineCards.map((card) => normalizeDeckCard(card, baselineCategories)),
  );
  const working = mergeValidatedCardEntries(
    workingCards.map((card) => normalizeDeckCard(card, categories)),
  );
  const baselineById = new Map(baseline.map((card) => [diffCardKey(card), card]));
  const addedCards: ValidatedDeckCard[] = [];

  for (const workingCard of working) {
    const baselineQuantity = baselineById.get(diffCardKey(workingCard))?.quantity ?? 0;
    const quantity = workingCard.quantity - baselineQuantity;

    if (quantity > 0) {
      addedCards.push({ ...workingCard, quantity });
    }
  }

  return addedCards;
}

function diffCardKey(card: ValidatedDeckCard) {
  return deckCardEntryKey(card);
}

export function groupEditorRows(
  rows: EditorRow[],
  categories: DeckCategory[] = defaultDeckCategories(),
) {
  const grouped = Object.fromEntries(categories.map((category) => [category.id, []])) as Record<
    CardCategory,
    EditorRow[]
  >;

  for (const row of rows) {
    (grouped[row.category] ??= []).push(row);
  }

  return grouped;
}
