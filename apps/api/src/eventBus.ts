import type { GameEventStreamMessage } from "@deckdiff/schemas";

type Listener = (message: GameEventStreamMessage) => void;

export class EventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(message: GameEventStreamMessage): void {
    for (const listener of this.listeners) listener(message);
  }
}
