import {
  CARD_CATEGORIES,
  type CardCategory,
  mergeValidatedCards,
  type ValidatedDeckCard,
} from "../../lib/decklist";
import type { EditorRow } from "./types";

export function buildEditorRows(
  baselineCards: ValidatedDeckCard[],
  workingCards: ValidatedDeckCard[],
) {
  const baseline = mergeValidatedCards(baselineCards);
  const working = mergeValidatedCards(workingCards);
  const baselineById = new Map(baseline.map((card) => [card.oracleId, card]));
  const workingById = new Map(working.map((card) => [card.oracleId, card]));
  const allIds = new Set([...baselineById.keys(), ...workingById.keys()]);
  const rows: EditorRow[] = [];

  for (const oracleId of allIds) {
    const baselineCard = baselineById.get(oracleId);
    const workingCard = workingById.get(oracleId);
    const baselineQuantity = baselineCard?.quantity ?? 0;
    const currentQuantity = workingCard?.quantity ?? 0;

    rows.push({
      oracleId,
      name: workingCard?.name ?? baselineCard?.name ?? "Unknown Card",
      category: workingCard?.category ?? baselineCard?.category ?? "Other",
      typeLine: workingCard?.typeLine ?? baselineCard?.typeLine ?? "",
      setCode: workingCard?.setCode ?? baselineCard?.setCode,
      collectorNumber: workingCard?.collectorNumber ?? baselineCard?.collectorNumber,
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
      CARD_CATEGORIES.indexOf(left.category) - CARD_CATEGORIES.indexOf(right.category);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

export function groupEditorRows(rows: EditorRow[]) {
  const grouped: Record<CardCategory, EditorRow[]> = {
    Land: [],
    Creature: [],
    Artifact: [],
    Enchantment: [],
    Instant: [],
    Sorcery: [],
    Planeswalker: [],
    Battle: [],
    Other: [],
  };

  for (const row of rows) {
    grouped[row.category].push(row);
  }

  return grouped;
}
