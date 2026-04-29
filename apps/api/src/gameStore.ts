import { applyCommand, createGame, createId, toGameView } from "@deckdiff/core";
import type { GameCommand, GameEvent, GameState, GameView } from "@deckdiff/schemas";

export type GameMetadata = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type GameResponse = {
  game: GameMetadata;
  view: GameView;
};

export type GameCommandResponse = GameResponse & {
  event: GameEvent;
};

type GameRecord = GameMetadata & {
  state: GameState;
};

export class GameNotFoundError extends Error {
  constructor(gameId: string) {
    super(`game not found: ${gameId}`);
    this.name = "GameNotFoundError";
  }
}

export class GameStore {
  private games = new Map<string, GameRecord>();

  create(name: string): GameResponse {
    const now = new Date().toISOString();
    const record: GameRecord = {
      id: createId("game"),
      name,
      createdAt: now,
      updatedAt: now,
      state: createGame({ players: [] }),
    };
    this.games.set(record.id, record);
    return this.toResponse(record);
  }

  get(gameId: string): GameResponse {
    return this.toResponse(this.requireGame(gameId));
  }

  getEvents(gameId: string): GameEvent[] {
    return this.requireGame(gameId).state.eventLog;
  }

  apply(gameId: string, command: GameCommand): GameCommandResponse {
    const record = this.requireGame(gameId);
    const result = applyCommand(record.state, command);
    record.state = result.state;
    record.updatedAt = new Date().toISOString();
    return {
      ...this.toResponse(record),
      event: result.event,
    };
  }

  private requireGame(gameId: string): GameRecord {
    const record = this.games.get(gameId);
    if (!record) throw new GameNotFoundError(gameId);
    return record;
  }

  private toResponse(record: GameRecord): GameResponse {
    return {
      game: {
        id: record.id,
        name: record.name,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      view: toGameView(record.state),
    };
  }
}
