import type { GameState, GameView } from "@deckdiff/schemas";

export function toGameView(state: GameState): GameView {
  return {
    ...structuredClone(state),
    viewMode: "debug",
  };
}
