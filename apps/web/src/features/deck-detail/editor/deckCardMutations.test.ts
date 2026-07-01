import { describe, expect, it } from "vitest";
import type { ValidatedDeckCard } from "#/lib/decklist";
import {
  adjustCardQuantity,
  appendSearchCard,
  changeCardPrinting,
  moveCardToCategory,
} from "./deckCardMutations";

function card(overrides: Partial<ValidatedDeckCard> = {}): ValidatedDeckCard {
  return {
    oracleId: "oracle-1",
    name: "Lightning Bolt",
    quantity: 1,
    typeLine: "Instant",
    categoryId: "main",
    ...overrides,
  };
}

function row(overrides: Partial<ReturnType<typeof card>> = {}) {
  const deckCard = card(overrides);
  return {
    ...deckCard,
    category: deckCard.categoryId ?? "main",
    manaValue: deckCard.manaValue ?? 1,
    baselineQuantity: deckCard.quantity,
    currentQuantity: deckCard.quantity,
    status: "same" as const,
  };
}

describe("card entry mutations", () => {
  it("adds the same card to a different category as a separate entry", () => {
    const nextCards = appendSearchCard(
      [card({ quantity: 2, categoryId: "main" })],
      {
        oracleId: "oracle-1",
        name: "Lightning Bolt",
        typeLine: "Instant",
        category: "Instant",
        categoryId: "instant",
        manaValue: 1,
      },
      "sideboard",
    );

    expect(nextCards).toMatchObject([
      { oracleId: "oracle-1", quantity: 2, categoryId: "main" },
      { oracleId: "oracle-1", quantity: 1, categoryId: "sideboard" },
    ]);
  });

  it("adjusts only the matching category entry", () => {
    const nextCards = adjustCardQuantity(
      [card({ quantity: 2, categoryId: "main" }), card({ quantity: 1, categoryId: "sideboard" })],
      row({ categoryId: "sideboard", quantity: 1 }),
      1,
    );

    expect(nextCards).toMatchObject([
      { quantity: 2, categoryId: "main" },
      { quantity: 2, categoryId: "sideboard" },
    ]);
  });

  it("merges quantities when moving into a category with the same card", () => {
    const nextCards = moveCardToCategory(
      [card({ quantity: 2, categoryId: "main" }), card({ quantity: 1, categoryId: "sideboard" })],
      row({ categoryId: "main", quantity: 2 }),
      "sideboard",
    );

    expect(nextCards).toMatchObject([
      { oracleId: "oracle-1", quantity: 3, categoryId: "sideboard" },
    ]);
  });
});

describe("changeCardPrinting", () => {
  it("updates printing fields while preserving quantity and category", () => {
    const cards = [
      {
        oracleId: "oracle-1",
        name: "Bedevil",
        quantity: 3,
        typeLine: "Instant",
        categoryId: "instant",
        manaValue: 3,
        setCode: "RNA",
        collectorNumber: "157",
        imageUrl: "old.jpg",
      },
      {
        oracleId: "oracle-2",
        name: "Island",
        quantity: 1,
        typeLine: "Basic Land - Island",
        categoryId: "land",
      },
    ];

    const nextCards = changeCardPrinting(
      cards,
      {
        oracleId: "oracle-1",
        name: "Bedevil",
        category: "instant",
        typeLine: "Instant",
        manaValue: 3,
        setCode: "RNA",
        collectorNumber: "157",
        imageUrl: "old.jpg",
        baselineQuantity: 3,
        currentQuantity: 3,
        status: "same",
      },
      {
        scryfallId: "print-2",
        oracleId: "oracle-1",
        name: "Bedevil",
        setCode: "DMC",
        setName: "Dominaria United Commander",
        collectorNumber: "144",
        releasedAt: "2022-09-09",
        priceUsd: 0.99,
        smallImageUrl: "new-small.jpg",
        imageUrl: "new.jpg",
        faces: [
          {
            name: "Bedevil",
            typeLine: "Instant",
            smallImageUrl: "new-small.jpg",
            imageUrl: "new.jpg",
          },
          {
            name: "Bedevil Back",
            typeLine: "Instant",
            smallImageUrl: "new-back-small.jpg",
            imageUrl: "new-back.jpg",
          },
        ],
      },
    );

    expect(nextCards[0]).toMatchObject({
      quantity: 3,
      categoryId: "instant",
      setCode: "DMC",
      collectorNumber: "144",
      smallImageUrl: "new-small.jpg",
      imageUrl: "new.jpg",
      faces: expect.arrayContaining([expect.objectContaining({ imageUrl: "new-back.jpg" })]),
    });
    expect(nextCards[1]).toBe(cards[1]);
  });
});
