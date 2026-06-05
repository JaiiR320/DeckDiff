import { describe, expect, it } from "vitest";
import type { DeckTileCover } from "./deck";
import type { DeckCategory, ValidatedDeckCard } from "./decklist";
import {
  createCommanderDeckCover,
  shouldRefreshCommanderCover,
  swapSplitDeckCover,
} from "./deckCover";

const commanderCategory: DeckCategory = { id: "cmd", name: " Commander ", kind: "custom" };
const mainCategory: DeckCategory = { id: "main", name: "Main", kind: "custom" };

function card(overrides: Partial<ValidatedDeckCard> = {}): ValidatedDeckCard {
  return {
    oracleId: "oracle-1",
    name: "Commander One",
    quantity: 1,
    typeLine: "Legendary Creature",
    categoryId: "cmd",
    setCode: "TST",
    collectorNumber: "1",
    imageUrl: "https://cards.example/one.jpg",
    ...overrides,
  };
}

describe("createCommanderDeckCover", () => {
  it("returns null without a commander category", () => {
    expect(createCommanderDeckCover([mainCategory], [card()])).toBeNull();
  });

  it("creates a single commander cover from one commander card", () => {
    expect(createCommanderDeckCover([commanderCategory], [card()])).toEqual({
      oracleId: "oracle-1",
      setCode: "TST",
      collectorNumber: "1",
      name: "Commander One",
      imageUrl: "https://cards.example/one.jpg",
      source: "commander",
      kind: "single",
    });
  });

  it("creates a split commander cover from two commander cards", () => {
    expect(
      createCommanderDeckCover(
        [commanderCategory],
        [
          card(),
          card({
            oracleId: "oracle-2",
            name: "Commander Two",
            imageUrl: "https://cards.example/two.jpg",
          }),
        ],
      ),
    ).toEqual({
      source: "commander",
      kind: "split",
      cards: [
        expect.objectContaining({ name: "Commander One" }),
        expect.objectContaining({ name: "Commander Two" }),
      ],
    });
  });

  it("preserves split cover side order when refreshing commander cover", () => {
    expect(
      createCommanderDeckCover(
        [commanderCategory],
        [
          card(),
          card({
            oracleId: "oracle-2",
            name: "Commander Two",
            imageUrl: "https://cards.example/two.jpg",
          }),
        ],
        {
          source: "commander",
          kind: "split",
          reversed: true,
          cards: [
            { oracleId: "old-1", name: "Old One", imageUrl: "https://cards.example/old-one.jpg" },
            { oracleId: "old-2", name: "Old Two", imageUrl: "https://cards.example/old-two.jpg" },
          ],
        },
      ),
    ).toMatchObject({ kind: "split", reversed: true });
  });

  it("preserves commander cover crops when refreshing matching cards", () => {
    expect(
      createCommanderDeckCover([commanderCategory], [card()], {
        source: "commander",
        kind: "single",
        oracleId: "oracle-1",
        setCode: "TST",
        collectorNumber: "1",
        name: "Commander One",
        imageUrl: "https://cards.example/one.jpg",
        crop: { x: 0, y: 0.2, width: 1, height: 0.5 },
      }),
    ).toMatchObject({ crop: { x: 0, y: 0.2, width: 1, height: 0.5 } });
  });

  it("ignores commander cards without images", () => {
    expect(
      createCommanderDeckCover([commanderCategory], [card({ imageUrl: undefined })]),
    ).toBeNull();
  });
});

describe("swapSplitDeckCover", () => {
  it("toggles split cover side order without changing cards", () => {
    const cover: DeckTileCover = {
      source: "commander",
      kind: "split",
      cards: [
        { oracleId: "one", name: "One", imageUrl: "https://cards.example/one.jpg" },
        { oracleId: "two", name: "Two", imageUrl: "https://cards.example/two.jpg" },
      ],
    };

    expect(swapSplitDeckCover(cover)).toEqual({ ...cover, reversed: true });
    expect(swapSplitDeckCover({ ...cover, reversed: true })).toEqual({ ...cover, reversed: false });
  });
});

describe("shouldRefreshCommanderCover", () => {
  it("refreshes missing and commander covers without overwriting manual covers", () => {
    const manualCover: DeckTileCover = {
      oracleId: "manual",
      name: "Manual",
      imageUrl: "https://cards.example/manual.jpg",
      source: "manual",
      kind: "single",
    };

    expect(shouldRefreshCommanderCover(undefined)).toBe(true);
    expect(shouldRefreshCommanderCover({ ...manualCover, source: "commander" })).toBe(true);
    expect(shouldRefreshCommanderCover(manualCover)).toBe(false);
    expect(shouldRefreshCommanderCover({ oracleId: "legacy", name: "Legacy", imageUrl: "x" })).toBe(
      false,
    );
  });
});
