import { afterEach, describe, expect, it, vi } from "vitest";
import { getCardPreview, getCardSymbols } from "./scryfall";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getCardPreview", () => {
  it("fetches and caches a specific print when set data is available", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: "Lightning Bolt",
        oracle_id: "oracle-1",
        id: "card-1",
        type_line: "Instant",
        set: "lea",
        collector_number: "161",
        image_uris: {
          small: "https://cards.scryfall.io/small/front/l/b/lightning-bolt.jpg",
          normal: "https://cards.scryfall.io/normal/front/l/b/lightning-bolt.jpg",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const firstPreview = await getCardPreview({
      name: "Lightning Bolt",
      setCode: "LEA",
      collectorNumber: "161",
    });
    const secondPreview = await getCardPreview({
      name: "Lightning Bolt",
      setCode: "LEA",
      collectorNumber: "161",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.scryfall.com/cards/lea/161", {
      headers: { Accept: "application/json" },
    });
    expect(firstPreview).toEqual(secondPreview);
    expect(firstPreview?.imageUrl).toContain("lightning-bolt.jpg");
  });

  it("falls back to exact-name lookup when a specific print is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "Counterspell",
          oracle_id: "oracle-2",
          id: "card-2",
          type_line: "Instant",
          set: "7ed",
          collector_number: "67",
          card_faces: [
            {
              image_uris: {
                small: "https://cards.scryfall.io/small/front/c/o/counterspell.jpg",
                normal: "https://cards.scryfall.io/normal/front/c/o/counterspell.jpg",
              },
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const preview = await getCardPreview({
      name: "Counterspell",
      setCode: "TMP",
      collectorNumber: "999",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.scryfall.com/cards/tmp/999", {
      headers: { Accept: "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.scryfall.com/cards/named?exact=Counterspell",
      {
        headers: { Accept: "application/json" },
      },
    );
    expect(preview?.name).toBe("Counterspell");
    expect(preview?.imageUrl).toContain("counterspell.jpg");
  });
});

describe("getCardSymbols", () => {
  it("fetches and caches Scryfall symbology", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            symbol: "{T}",
            english: "tap this permanent",
            svg_uri: "https://svgs.scryfall.io/card-symbols/T.svg",
          },
          {
            symbol: "{C}",
            english: "one colorless mana",
            svg_uri: "https://svgs.scryfall.io/card-symbols/C.svg",
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const firstSymbols = await getCardSymbols();
    const secondSymbols = await getCardSymbols();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.scryfall.com/symbology", {
      headers: { Accept: "application/json" },
    });
    expect(firstSymbols).toBe(secondSymbols);
    expect(firstSymbols.get("{T}")).toEqual({
      symbol: "{T}",
      english: "tap this permanent",
      svgUri: "https://svgs.scryfall.io/card-symbols/T.svg",
    });
  });
});
