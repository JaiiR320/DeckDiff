import { z } from "zod";
import { gameEventSchema, gameStateSchema } from "./stateSchemas.js";

export const gameViewSchema = gameStateSchema.extend({
  viewMode: z.literal("debug"),
});

export const commandResponseSchema = z.object({
  view: gameViewSchema,
  event: gameEventSchema,
});

export const gameEventStreamMessageSchema = z.object({
  type: z.literal("game.event"),
  gameId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  event: gameEventSchema,
  view: gameViewSchema,
});

export type GameView = z.infer<typeof gameViewSchema>;
export type CommandResponse = z.infer<typeof commandResponseSchema>;
export type GameEventStreamMessage = z.infer<typeof gameEventStreamMessageSchema>;
