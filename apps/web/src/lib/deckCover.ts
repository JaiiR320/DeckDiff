import type { DeckTileCover, DeckTileCoverCard, ImageCrop } from "./deck";
import {
  normalizeCategoryNameForCompare,
  normalizeDeckCard,
  normalizeDeckCategories,
  type DeckCategory,
  type ValidatedDeckCard,
} from "./decklist";

export function createCommanderDeckCover(
  categories: DeckCategory[] | undefined,
  cards: ValidatedDeckCard[],
  previousCover?: DeckTileCover | null,
): DeckTileCover | null {
  const normalizedCategories = normalizeDeckCategories(categories);
  const commanderCategory = normalizedCategories.find(
    (category) => normalizeCategoryNameForCompare(category.name) === "commander",
  );

  if (!commanderCategory) {
    return null;
  }

  const commanderCards: DeckTileCoverCard[] = [];
  for (const card of cards) {
    const normalizedCard = normalizeDeckCard(card, normalizedCategories);
    if (normalizedCard.categoryId === commanderCategory.id && normalizedCard.imageUrl) {
      commanderCards.push(
        toCoverCard(normalizedCard, findPreviousCrop(previousCover, normalizedCard)),
      );
    }
  }

  if (commanderCards.length >= 2) {
    return {
      source: "commander",
      kind: "split",
      cards: [commanderCards[0]!, commanderCards[1]!],
      reversed: previousCover?.kind === "split" ? previousCover.reversed : undefined,
    };
  }

  const commanderCard = commanderCards[0];
  if (!commanderCard) {
    return null;
  }

  return { ...commanderCard, source: "commander", kind: "single" };
}

export function shouldRefreshCommanderCover(cover: DeckTileCover | null | undefined) {
  return !cover || cover.source === "commander";
}

export function swapSplitDeckCover(cover: DeckTileCover): DeckTileCover {
  return cover.kind === "split" ? { ...cover, reversed: !cover.reversed } : cover;
}

function toCoverCard(card: ValidatedDeckCard, crop?: ImageCrop): DeckTileCoverCard {
  return {
    oracleId: card.oracleId,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber,
    name: card.name,
    imageUrl: card.imageUrl!,
    crop,
  };
}

function findPreviousCrop(
  cover: DeckTileCover | null | undefined,
  card: ValidatedDeckCard,
): ImageCrop | undefined {
  if (!cover) return undefined;

  const previousCards = cover.kind === "split" ? cover.cards : [cover];
  return previousCards.find((previousCard) => isSameCoverCard(previousCard, card))?.crop;
}

function isSameCoverCard(coverCard: DeckTileCoverCard, card: ValidatedDeckCard) {
  return (
    coverCard.oracleId === card.oracleId &&
    coverCard.setCode === card.setCode &&
    coverCard.collectorNumber === card.collectorNumber &&
    coverCard.imageUrl === card.imageUrl
  );
}
