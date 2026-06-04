import { describe, expect, it } from "vitest";
import {
  updateDeckColorsInputSchema,
  updateDeckCoverInputSchema,
  updateDeckCurrentInputSchema,
  updateFolderBackgroundInputSchema,
} from "./deckSchemas";

describe("updateDeckCurrentInputSchema", () => {
  it("preserves enriched card data when persisting current deck state", () => {
    const input = {
      deckId: "test-deck",
      categories: [{ id: "instant", name: "Instant" }],
      layout: { lanes: [["instant"]] },
      cards: [
        {
          oracleId: "oracle-1",
          name: "Opt",
          quantity: 2,
          typeLine: "Instant",
          categoryId: "instant",
          manaValue: 1,
          setCode: "DOM",
          collectorNumber: "60",
          smallImageUrl: "small.jpg",
          imageUrl: "normal.jpg",
          priceUsd: 0.25,
          edhrecRank: 1234,
          faces: [
            {
              name: "Opt",
              typeLine: "Instant",
              manaCost: "{U}",
              oracleText: "Scry 1. Draw a card.",
              smallImageUrl: "face-small.jpg",
              imageUrl: "face-normal.jpg",
            },
          ],
        },
      ],
    };

    expect(updateDeckCurrentInputSchema.parse(input).cards[0]).toMatchObject({
      smallImageUrl: "small.jpg",
      imageUrl: "normal.jpg",
      priceUsd: 0.25,
      edhrecRank: 1234,
      faces: [
        {
          name: "Opt",
          typeLine: "Instant",
          manaCost: "{U}",
          oracleText: "Scry 1. Draw a card.",
          smallImageUrl: "face-small.jpg",
          imageUrl: "face-normal.jpg",
        },
      ],
    });
  });
});

describe("updateDeckColorsInputSchema", () => {
  it("accepts only deck colors", () => {
    expect(updateDeckColorsInputSchema.parse({ deckId: "test-deck", colors: ["U", "B"] })).toEqual({
      deckId: "test-deck",
      colors: ["U", "B"],
    });
    expect(() =>
      updateDeckColorsInputSchema.parse({ deckId: "test-deck", colors: ["U", "C"] }),
    ).toThrow();
  });
});

describe("updateDeckCoverInputSchema", () => {
  it("accepts cover crop settings", () => {
    expect(
      updateDeckCoverInputSchema.parse({
        deckId: "test-deck",
        cover: {
          oracleId: "oracle-1",
          name: "Opt",
          imageUrl: "normal.jpg",
          source: "manual",
          kind: "single",
          crop: { x: 0, y: 0.2, width: 1, height: 0.5 },
        },
      }).cover,
    ).toMatchObject({ crop: { x: 0, y: 0.2, width: 1, height: 0.5 } });
  });
});

describe("updateFolderBackgroundInputSchema", () => {
  it("accepts and clears folder backgrounds", () => {
    expect(
      updateFolderBackgroundInputSchema.parse({
        folderId: "folder-1",
        background: {
          imageUrl: "https://cards.scryfall.io/normal/front/a/b/card.jpg",
          crop: { x: 0.1, y: 0, width: 0.8, height: 0.2 },
        },
      }).background,
    ).toMatchObject({ crop: { x: 0.1, y: 0, width: 0.8, height: 0.2 } });

    expect(
      updateFolderBackgroundInputSchema.parse({ folderId: "folder-1", background: null }),
    ).toEqual({ folderId: "folder-1", background: null });
  });
});
