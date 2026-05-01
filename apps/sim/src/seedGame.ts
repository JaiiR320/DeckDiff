import { createGame } from "@deckdiff/core";
import type { GameState } from "@deckdiff/schemas";

/** Creates the local seed game until server state exists. */
export function createSeedGame(): GameState {
  return createGame({
    players: [
      {
        id: "p1",
        name: "Player",
        library: [
          "Brainstorm",
          "Ponder",
          "Counterspell",
          "Island",
          "Swords to Plowshares",
          "Mystic Remora",
          "Arcane Signet",
          "Malakir Rebirth",
          "Sol Ring",
          "Island",
          "Command Tower",
          "Llanowar Elves",
          "Lightning Greaves",
          "Rhystic Study",
        ],
        hand: ["Charred Foyer // Warped Space"],
        battlefield: [],
        graveyard: [],
        exile: [],
        command: [],
      },
    ],
  });
}
