import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z, ZodError } from "zod";
import { GameCommandError } from "@deckdiff/core";
import { gameCommandSchema } from "@deckdiff/schemas";
import { EventBus } from "./eventBus.js";
import { GameNotFoundError, GameStore } from "./gameStore.js";

const createGameRequestSchema = z.object({
  name: z.string().min(1),
});

export function createApp(store = new GameStore(), bus = new EventBus()): Hono {
  const app = new Hono();

  app.use("*", cors());

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/games", async (c) => {
    const request = createGameRequestSchema.parse(await c.req.json());
    return c.json(store.create(request.name), 201);
  });

  app.get("/games/:gameId", (c) => c.json(store.get(c.req.param("gameId"))));

  app.post("/games/:gameId/commands", async (c) => {
    const gameId = c.req.param("gameId");
    const command = gameCommandSchema.parse(await c.req.json());
    const response = store.apply(gameId, command);
    bus.publish({
      type: "game.event",
      gameId,
      revision: response.view.revision,
      event: response.event,
      view: response.view,
    });
    return c.json(response);
  });

  app.get("/games/:gameId/events", (c) => {
    return c.json({ events: store.getEvents(c.req.param("gameId")) });
  });

  app.get("/games/:gameId/events/stream", (c) => {
    const gameId = c.req.param("gameId");
    store.get(gameId);

    return streamSSE(c, async (stream) => {
      const queue: string[] = [];
      let notify: (() => void) | undefined;
      const unsubscribe = bus.subscribe((message) => {
        if (message.gameId !== gameId) return;
        queue.push(JSON.stringify(message));
        notify?.();
      });

      stream.onAbort(unsubscribe);

      while (true) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
          notify = undefined;
        }

        const next = queue.shift();
        if (next) {
          await stream.writeSSE({ event: "game.event", data: next });
        }
      }
    });
  });

  app.onError((err, c) => {
    if (err instanceof ZodError) {
      return c.json({ error: "invalid_request", issues: err.issues }, 400);
    }
    if (err instanceof GameCommandError) {
      return c.json({ error: "command_error", message: err.message }, 400);
    }
    if (err instanceof GameNotFoundError) {
      return c.json({ error: "not_found", message: err.message }, 404);
    }
    console.error(err);
    return c.json({ error: "internal_server_error" }, 500);
  });

  return app;
}
