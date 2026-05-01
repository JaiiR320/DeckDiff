import { afterEach, describe, expect, it, vi } from "vitest";
import { cardImageCacheKey, getCardImage, normalizeCardImageName } from "./cardImages.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("card image helpers", () => {
  it("normalizes card names for lookup and cache keys", () => {
    expect(normalizeCardImageName("  Fire   // Ice  ")).toBe("Fire // Ice");
    expect(cardImageCacheKey("Fire // Ice")).toBe("fire // ice");
  });

  it("fetches and caches single-faced card images", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: "Lightning Bolt",
        image_uris: {
          normal: "https://cards.scryfall.io/normal/front/lightning-bolt.jpg",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const firstImage = await getCardImage("Lightning Bolt Cache Test");
    const secondImage = await getCardImage("Lightning Bolt Cache Test");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstImage).toEqual(secondImage);
    expect(firstImage).toEqual({
      name: "Lightning Bolt",
      frontImageUrl: "https://cards.scryfall.io/normal/front/lightning-bolt.jpg",
      alternateImageUrl: undefined,
      hasAlternateFace: false,
      layout: undefined,
      shouldRotatePreview: false,
    });
  });

  it("maps double-faced card images", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          name: "Delver of Secrets // Insectile Aberration",
          card_faces: [
            {
              image_uris: {
                normal: "https://cards.scryfall.io/normal/front/delver.jpg",
              },
            },
            {
              image_uris: {
                normal: "https://cards.scryfall.io/normal/back/insectile.jpg",
              },
            },
          ],
        }),
      }),
    );

    await expect(getCardImage("Delver of Secrets Cache Test")).resolves.toEqual({
      name: "Delver of Secrets // Insectile Aberration",
      frontImageUrl: "https://cards.scryfall.io/normal/front/delver.jpg",
      alternateImageUrl: "https://cards.scryfall.io/normal/back/insectile.jpg",
      hasAlternateFace: true,
      layout: undefined,
      shouldRotatePreview: false,
    });
  });

  it("returns null when Scryfall has no usable image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: "Missing Image" }),
      }),
    );

    await expect(getCardImage("Missing Image Cache Test")).resolves.toBeNull();
  });
});
