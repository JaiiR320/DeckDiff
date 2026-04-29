import type { GameCommand, GameEvent } from "@deckdiff/schemas";
import { createId } from "./ids.js";

export function createEvent(
  revision: number,
  command: GameCommand,
  message: string,
  actorPlayerId?: string,
): GameEvent {
  return {
    id: createId("event"),
    revision,
    timestamp: new Date().toISOString(),
    type: command.type,
    actorPlayerId,
    message,
    commandType: command.type,
  };
}
