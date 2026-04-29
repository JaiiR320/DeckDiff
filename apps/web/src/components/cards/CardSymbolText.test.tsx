import { describe, expect, it } from "vitest";
import { splitCardSymbolText } from "./CardSymbolText";

describe("splitCardSymbolText", () => {
  it("splits oracle text into text and symbol tokens", () => {
    expect(splitCardSymbolText("{T}: Add {C}. Basic landcycling {1}")).toEqual([
      { type: "symbol", value: "{T}" },
      { type: "text", value: ": Add " },
      { type: "symbol", value: "{C}" },
      { type: "text", value: ". Basic landcycling " },
      { type: "symbol", value: "{1}" },
    ]);
  });

  it("returns a single text token when no symbols are present", () => {
    expect(splitCardSymbolText("Draw a card.")).toEqual([{ type: "text", value: "Draw a card." }]);
  });
});
